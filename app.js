(function () {
  var PROFILE_KEY = "steady_steps_profile";
  var SUPPORT_KEY = "steady_steps_support_circle";
  var FORM_KEY_PREFIX = "steady_steps_form_";
  var RESPONSE_KEY_PREFIX = "steady_steps_response_";
  var PLACEHOLDER_SUPABASE_URL = "YOUR_SUPABASE_URL";
  var PLACEHOLDER_SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY";

  var jobSearchForm = document.getElementById("jobSearchForm");
  var checkInForm = document.getElementById("checkInForm");
  var profileForm = document.getElementById("profileForm");
  var fridayReviewForm = document.getElementById("fridayReviewForm");
  var dreamBoardForm = document.getElementById("dreamBoardForm");
  var lumaForm = document.getElementById("lumaForm");
  var authForm = document.getElementById("authForm");

  var jobSearchResponse = document.getElementById("jobSearchResponse");
  var checkInResponse = document.getElementById("checkInResponse");
  var profileResponse = document.getElementById("profileResponse");
  var fridayReviewResponse = document.getElementById("fridayReviewResponse");
  var dreamBoardResponse = document.getElementById("dreamBoardResponse");
  var profilePreview = document.getElementById("profilePreview");
  var dreamProfilePreview = document.getElementById("dreamProfilePreview");
  var supportList = document.getElementById("supportList");
  var lumaChatWindow = document.getElementById("lumaChatWindow");
  var authEmail = document.getElementById("authEmail");
  var authPassword = document.getElementById("authPassword");
  var signInButton = document.getElementById("signInButton");
  var signUpButton = document.getElementById("signUpButton");
  var signOutButton = document.getElementById("signOutButton");
  var authStatusMessage = document.getElementById("authStatusMessage");

  var latestProfileAnswers = loadJson(PROFILE_KEY);
  var supportConnections = loadJson(SUPPORT_KEY) || [];
  var connectionButtons = document.getElementsByClassName("add-connection-button");
  var supabaseClient = createSupabaseClient();
  var currentSession = null;
  var i;

  if (profilePreview && latestProfileAnswers) {
    profilePreview.innerHTML = buildProfilePreview(latestProfileAnswers);
  }

  if (dreamProfilePreview && latestProfileAnswers) {
    dreamProfilePreview.innerHTML = buildDreamProfilePreview(latestProfileAnswers);
  }

  if (supportList) {
    renderSupportConnections();
  }

  initializeAuth();

  setupPersistentForm(jobSearchForm, jobSearchResponse);
  setupPersistentForm(checkInForm, checkInResponse);
  setupPersistentForm(profileForm, profileResponse);
  setupPersistentForm(fridayReviewForm, fridayReviewResponse);
  setupPersistentForm(dreamBoardForm, dreamBoardResponse);
  setupPersistentForm(lumaForm, null);

  if (jobSearchForm) {
    jobSearchForm.onsubmit = function (event) {
      prevent(event);
      var answers = getFormAnswers(jobSearchForm);
      jobSearchResponse.innerHTML = buildJobSearchResponse(answers);
      jobSearchResponse.className = "response-card";
      saveResponse("jobSearchForm", jobSearchResponse.innerHTML);
      return false;
    };
  }

  if (checkInForm) {
    checkInForm.onsubmit = function (event) {
      prevent(event);
      var answers = getFormAnswers(checkInForm);
      checkInResponse.innerHTML = buildCheckInResponse(answers);
      checkInResponse.className = "response-card";
      saveResponse("checkInForm", checkInResponse.innerHTML);
      return false;
    };
  }

  if (profileForm) {
    profileForm.onsubmit = function (event) {
      prevent(event);
      var savedProfileState = loadJson(FORM_KEY_PREFIX + "profileForm") || {};
      var answers = mergeObjects(savedProfileState, getFormAnswers(profileForm));
      latestProfileAnswers = answers;
      saveJson(PROFILE_KEY, answers);
      profileResponse.innerHTML = buildProfileResponse(answers);
      profileResponse.className = "response-card";
      saveResponse("profileForm", profileResponse.innerHTML);
      saveProfileToSupabase(answers);
      if (profilePreview) {
        profilePreview.innerHTML = buildProfilePreview(answers);
      }
      if (dreamProfilePreview) {
        dreamProfilePreview.innerHTML = buildDreamProfilePreview(answers);
      }
      return false;
    };
  }

  if (fridayReviewForm) {
    fridayReviewForm.onsubmit = function (event) {
      prevent(event);
      var answers = getFormAnswers(fridayReviewForm);
      fridayReviewResponse.innerHTML = buildFridayReviewResponse(answers);
      fridayReviewResponse.className = "response-card";
      saveResponse("fridayReviewForm", fridayReviewResponse.innerHTML);
      return false;
    };
  }

  if (dreamBoardForm) {
    dreamBoardForm.onsubmit = function (event) {
      prevent(event);
      var answers = getFormAnswers(dreamBoardForm);
      dreamBoardResponse.innerHTML = buildDreamBoardResponse(answers, latestProfileAnswers);
      dreamBoardResponse.className = "response-card";
      saveResponse("dreamBoardForm", dreamBoardResponse.innerHTML);
      return false;
    };
  }

  if (lumaForm) {
    lumaForm.onsubmit = function (event) {
      prevent(event);
      var answers = getFormAnswers(lumaForm);
      appendChatBubble("user", answers.lumaMessage);
      appendChatBubble("bot", buildLumaResponse(answers.lumaMessage, latestProfileAnswers));
      saveFormState("lumaForm", getFormAnswers(lumaForm));
      lumaForm.reset();
      clearFormState("lumaForm");
      setSaveStatus("lumaForm", "Your draft was sent. New drafts will save as you type.");
      if (lumaChatWindow) {
        lumaChatWindow.scrollTop = lumaChatWindow.scrollHeight;
      }
      return false;
    };
  }

  if (signInButton) {
    signInButton.onclick = function () {
      signInWithSupabase();
    };
  }

  if (signUpButton) {
    signUpButton.onclick = function () {
      signUpWithSupabase();
    };
  }

  if (signOutButton) {
    signOutButton.onclick = function () {
      signOutWithSupabase();
    };
  }

  for (i = 0; i < connectionButtons.length; i += 1) {
    connectionButtons[i].onclick = function () {
      addSupportConnection({
        name: this.getAttribute("data-name"),
        major: this.getAttribute("data-major"),
        goal: this.getAttribute("data-goal"),
        topic: this.getAttribute("data-topic"),
        type: this.getAttribute("data-type")
      });
    };
  }

  function prevent(event) {
    if (event && event.preventDefault) {
      event.preventDefault();
    }
  }

  function initializeAuth() {
    if (!supabaseClient) {
      updateAuthStatus("Add your Supabase URL and anon key in supabase-config.js to turn login on.");
      return;
    }

    supabaseClient.auth.getSession().then(function (result) {
      currentSession = result && result.data ? result.data.session : null;
      updateAuthStatusFromSession();
      if (currentSession) {
        loadProfileFromSupabase();
      }
    });

    supabaseClient.auth.onAuthStateChange(function (event, session) {
      currentSession = session;
      updateAuthStatusFromSession();
      if (session) {
        loadProfileFromSupabase();
      }
    });
  }

  function signInWithSupabase() {
    if (!supabaseClient || !authEmail || !authPassword) {
      updateAuthStatus("Supabase is not configured yet.");
      return;
    }

    supabaseClient.auth.signInWithPassword({
      email: authEmail.value,
      password: authPassword.value
    }).then(function (result) {
      if (result.error) {
        updateAuthStatus(result.error.message);
        return;
      }

      updateAuthStatus("You are logged in.");
    });
  }

  function signUpWithSupabase() {
    if (!supabaseClient || !authEmail || !authPassword) {
      updateAuthStatus("Supabase is not configured yet.");
      return;
    }

    supabaseClient.auth.signUp({
      email: authEmail.value,
      password: authPassword.value
    }).then(function (result) {
      if (result.error) {
        updateAuthStatus(result.error.message);
        return;
      }

      updateAuthStatus("Check your email if your project requires confirmation, then log in.");
    });
  }

  function signOutWithSupabase() {
    if (!supabaseClient) {
      updateAuthStatus("Supabase is not configured yet.");
      return;
    }

    supabaseClient.auth.signOut().then(function () {
      updateAuthStatus("You are logged out.");
    });
  }

  function updateAuthStatusFromSession() {
    if (currentSession && currentSession.user) {
      updateAuthStatus("Signed in as " + currentSession.user.email + ".");
      return;
    }

    updateAuthStatus("You are not logged in yet.");
  }

  function updateAuthStatus(message) {
    if (authStatusMessage) {
      authStatusMessage.textContent = message;
    }
  }

  function getFormAnswers(form) {
    var fields = form.elements;
    var answers = {};
    var index;

    for (index = 0; index < fields.length; index += 1) {
      if (!fields[index].name) {
        continue;
      }

      if ((fields[index].type === "radio" || fields[index].type === "checkbox") && !fields[index].checked) {
        continue;
      }

      if (fields[index].type === "file") {
        answers[fields[index].name] = fields[index].files && fields[index].files.length > 0 ? fields[index].files[0].name : "";
        continue;
      }

      answers[fields[index].name] = fields[index].value;
    }

    return answers;
  }

  function buildJobSearchResponse(answers) {
    var feeling = parseInt(answers.feeling, 10);
    var feelingLine = getFeelingAcknowledgement(feeling);
    var priorityLine = getPriorityReflection(answers.priority, answers.careerGoals);
    var steps = getNextSteps(answers);
    var resumeFeedback = getResumeFeedback(answers);
    return (
      "<h3>Your steady next steps</h3>" +
      "<p>Based on what you shared, " + feelingLine + " You’re carrying <strong>" + escapeHtml(answers.struggle) + "</strong>, and that can take real energy.</p>" +
      "<p>You’re graduating <strong>" + escapeHtml(answers.graduationDate) + "</strong> with a background in <strong>" + escapeHtml(answers.major) + "</strong>, and you’re aiming toward <strong>" + escapeHtml(answers.careerGoals) + "</strong>.</p>" +
      "<p>It makes sense that <strong>" + escapeHtml(readablePriority(answers.priority)) + "</strong> is front and center. " + priorityLine + "</p>" +
      "<p>This is completely normal, especially when you care about making a thoughtful next move.</p>" +
      "<p>Three realistic next steps:</p>" +
      makeList(steps, "ul") +
      "<p>Resume writing help based on what you shared:</p>" +
      makeList(resumeFeedback, "ul") +
      "<p>You do not need to solve everything this week. Small, steady actions count.</p>"
    );
  }

  function buildCheckInResponse(answers) {
    return (
      "<h3>Your weekly reflection</h3>" +
      "<p>Based on what you shared, you’re feeling <strong>" + escapeHtml(answers.weeklyFeeling) + "</strong>, and that deserves honesty, not judgment.</p>" +
      "<p>You still made progress with <strong>" + escapeHtml(answers.accomplishment) + "</strong>. Even small steps matter.</p>" +
      "<p>It also makes sense that <strong>" + escapeHtml(answers.hardPart) + "</strong> felt hard. This is completely normal. Job searching can be emotionally uneven.</p>" +
      "<p>For next week, keep your focus narrow: <strong>" + escapeHtml(answers.nextGoal) + "</strong>. One meaningful step is enough.</p>"
    );
  }

  function buildProfileResponse(answers) {
    var displayName = getDisplayName(answers);
    return (
      "<h3>Profile created</h3>" +
      "<p><strong>" + escapeHtml(displayName) + "</strong>, your profile preview is ready on the right.</p>" +
      "<p>Based on what you shared, your current direction centers on <strong>" + escapeHtml(answers.jobGoal) + "</strong>, and you’re studying <strong>" + escapeHtml(answers.profileMajor) + "</strong> at <strong>" + escapeHtml(answers.institution) + "</strong> with interests in <strong>" + escapeHtml(answers.careerInterests) + "</strong>.</p>" +
      "<p>You’re excited about <strong>" + escapeHtml(answers.excitedAbout) + "</strong>, and you’re working through <strong>" + escapeHtml(answers.strugglingWith) + "</strong>. This is completely normal, and it gives your profile a real sense of who you are.</p>" +
      "<p>If you want, you can carry this into your <a href='dream-board.html'>Dream Board</a> next and write about the kind of life and work you want to build around these goals.</p>" +
      "<p>This is only a front-end prototype, so the profile is not saved to any backend.</p>"
    );
  }

  function buildProfilePreview(answers) {
    var displayName = getDisplayName(answers);
    var avatarHtml = buildProfileAvatar(answers, displayName);
    return (
      "<div class='profile-summary'>" +
      "<span class='mini-label'>Your profile preview</span>" +
      "<div class='profile-header'>" +
      avatarHtml +
      "<div>" +
      "<h3>" + escapeHtml(displayName) + "</h3>" +
      "<p class='card-line'>" + escapeHtml(answers.profileMajor) + " at " + escapeHtml(answers.institution) + ", Class of " + escapeHtml(answers.graduationYear) + "</p>" +
      "</div>" +
      "</div>" +
      "<div class='profile-chip'>Career interests: " + escapeHtml(answers.careerInterests) + "</div>" +
      "</div>" +
      (answers.anonymous ? "<p><strong>Privacy:</strong> This profile is set to use a username or first-name fallback instead of a full name.</p>" : "") +
      "<p><strong>Current job search goal:</strong> " + escapeHtml(answers.jobGoal) + "</p>" +
      "<p><strong>Excited about:</strong> " + escapeHtml(answers.excitedAbout) + "</p>" +
      "<p><strong>Struggling with:</strong> " + escapeHtml(answers.strugglingWith) + "</p>" +
      "<p class='helper'>This preview is just for imagining the experience. No login, messaging, or database is connected yet.</p>"
    );
  }

  function buildDreamProfilePreview(answers) {
    var displayName = getDisplayName(answers);
    var avatarHtml = buildProfileAvatar(answers, displayName);
    return (
      "<div class='profile-summary'>" +
      "<span class='mini-label'>Saved profile snapshot</span>" +
      "<div class='profile-header'>" +
      avatarHtml +
      "<div>" +
      "<h3>" + escapeHtml(displayName) + "</h3>" +
      "<p class='card-line'>" + escapeHtml(answers.profileMajor) + " at " + escapeHtml(answers.institution) + "</p>" +
      "</div>" +
      "</div>" +
      "<div class='profile-chip'>Current goal: " + escapeHtml(answers.jobGoal) + "</div>" +
      "</div>" +
      "<p class='helper'>Your dream board can sit beside your profile so your future plans still feel tied to your real interests and priorities.</p>"
    );
  }

  function buildFridayReviewResponse(answers) {
    var applications = parseInt(answers.applications, 10) || 0;
    var interviews = parseInt(answers.interviews, 10) || 0;
    var stepsCompleted = parseInt(answers.stepsCompleted, 10) || 0;
    var nextSteps = getFridayNextSteps(applications, interviews, stepsCompleted);
    return (
      "<h3>Your Friday Review</h3>" +
      "<p>Based on what you shared, this week you applied to <strong>" + applications + "</strong> role" + pluralize(applications) + " and received <strong>" + interviews + "</strong> interview" + pluralize(interviews) + ".</p>" +
      "<p>You completed <strong>" + stepsCompleted + "</strong> out of <strong>3</strong> steps. " + getFridayReflection(applications, interviews, stepsCompleted) + "</p>" +
      "<p>Next week, it may help to focus on:</p>" +
      makeList(nextSteps, "ol")
    );
  }

  function buildDreamBoardResponse(answers, profileAnswers) {
    var displayName = profileAnswers ? getDisplayName(profileAnswers) : "you";
    var intro = profileAnswers
      ? "Written by " + escapeHtml(displayName) + ", and connected to the bigger story they are building."
      : "A private reflection on the kind of life and work you want to grow into.";

    return (
      "<div class='dream-entry'>" +
      "<p class='eyebrow'>Dream Board Entry</p>" +
      "<h3>" + escapeHtml(answers.dreamTitle || "My dream board") + "</h3>" +
      "<p class='dream-meta'>" + intro + "</p>" +
      "<div class='dream-quote'><strong>I want this next chapter to feel:</strong> " + escapeHtml(answers.dreamFeeling) + "</div>" +
      "<p>" + formatParagraphs(answers.dreamStory) + "</p>" +
      "<p><strong>Three hopes I want to hold onto:</strong></p>" +
      "<p>" + formatParagraphs(answers.dreamHopes) + "</p>" +
      "<p><strong>One milestone I would love to reach in the next year:</strong> " + escapeHtml(answers.dreamMilestone) + "</p>" +
      "<p class='helper'>This entry does not need to be polished. It just needs to feel honest enough to come back to.</p>" +
      "</div>"
    );
  }

  function buildLumaResponse(message, profileAnswers) {
    var normalized = String(message || "").toLowerCase();
    var intro = "Based on what you shared, ";
    var profileContext = "";
    var direction = "";

    if (profileAnswers) {
      profileContext = "I’m keeping in mind that you’re " + escapeHtml(profileAnswers.name) + ", studying " + escapeHtml(profileAnswers.profileMajor) + " at " + escapeHtml(profileAnswers.institution) + ", and focused on " + escapeHtml(profileAnswers.jobGoal) + ". ";
      direction = "You also mentioned feeling excited about " + escapeHtml(profileAnswers.excitedAbout) + " while navigating " + escapeHtml(profileAnswers.strugglingWith) + ". ";
    } else {
      profileContext = "I do not have a profile submission yet, so I’m responding just to this message. ";
    }

    if (containsAny(normalized, ["behind", "stuck", "lost", "overwhelmed", "discouraged"])) {
      return intro + "it sounds like things may feel heavy right now. " + profileContext + direction + "This is completely normal after graduation, especially when so much feels uncertain at once. Try keeping the next week very small: choose one target role, update one part of your resume, and send one message to someone in your field.";
    }

    if (containsAny(normalized, ["profile", "tailored", "feedback", "based on my profile"])) {
      if (profileAnswers) {
        return intro + profileContext + direction + "a practical next focus could be finding opportunities that line up with your interests in " + escapeHtml(profileAnswers.careerInterests) + ". If you want to build momentum, start with one application that fits your current goal and make sure your materials reflect what excites you most.";
      }
      return intro + "I can give more tailored feedback once you fill out the Profile page. For now, it may help to name your goal, your interests, and the part of the search that feels hardest so the guidance can feel more specific.";
    }

    if (containsAny(normalized, ["resume", "cv", "application"])) {
      return intro + profileContext + "it may help to look for one place where your materials can sound clearer or more specific. Focus on one section at a time, especially the parts that connect most directly to the work you want next.";
    }

    if (containsAny(normalized, ["interview", "network", "people", "reach out"])) {
      return intro + profileContext + "you do not need to force a big leap all at once. One thoughtful message or one practice answer can be enough for today, especially if you are trying to build consistency rather than urgency.";
    }

    return intro + profileContext + direction + "it seems like you may need a calmer place to sort out your next move. A good next step is to pick one area to focus on this week, keep it manageable, and let that be enough for now.";
  }

  function addSupportConnection(connection) {
    var exists = false;
    var index;

    for (index = 0; index < supportConnections.length; index += 1) {
      if (supportConnections[index].name === connection.name && supportConnections[index].type === connection.type) {
        exists = true;
      }
    }

    if (!exists) {
      supportConnections.push(connection);
      saveJson(SUPPORT_KEY, supportConnections);
    }

    renderSupportConnections();
  }

  function renderSupportConnections() {
    var html = "";
    var index;

    if (!supportList) {
      return;
    }

    if (!supportConnections.length) {
      supportList.innerHTML =
        "<div class='support-card'><h3>No connections added yet</h3><p class='helper'>When you add a friend or career support buddy from the community, they will appear here.</p></div>";
      return;
    }

    for (index = 0; index < supportConnections.length; index += 1) {
      html +=
        "<div class='support-card'>" +
        "<span class='card-tag'>" + escapeHtml(supportConnections[index].type) + "</span>" +
        "<h3>" + escapeHtml(supportConnections[index].name) + "</h3>" +
        "<p class='card-line'>" + escapeHtml(supportConnections[index].major) + "</p>" +
        "<p><strong>Career goal:</strong> " + escapeHtml(supportConnections[index].goal) + "</p>" +
        "<p><strong>Can support you with:</strong> " + escapeHtml(supportConnections[index].topic) + "</p>" +
        "</div>";
    }

    supportList.innerHTML = html;
  }

  function setupPersistentForm(form, responseElement) {
    var savedState;
    var savedResponse;
    var fields;
    var index;

    if (!form || !form.id) {
      return;
    }

    savedState = loadJson(FORM_KEY_PREFIX + form.id);
    if (savedState) {
      applyFormState(form, savedState);
      setSaveStatus(form.id, "Saved entries restored on this device.");
    }

    savedResponse = loadText(RESPONSE_KEY_PREFIX + form.id);
    if (savedResponse && responseElement) {
      responseElement.innerHTML = savedResponse;
      responseElement.className = "response-card";
    }

    fields = form.elements;
    for (index = 0; index < fields.length; index += 1) {
      if (!fields[index].name) {
        continue;
      }

      if (fields[index].type === "file") {
        fields[index].addEventListener("change", function () {
          persistFilePreview(form, this);
        });
        continue;
      }

      fields[index].addEventListener("input", function () {
        saveFormState(form.id, getFormAnswers(form));
        setSaveStatus(form.id, "Saved on this device.");
      });

      fields[index].addEventListener("change", function () {
        saveFormState(form.id, getFormAnswers(form));
        setSaveStatus(form.id, "Saved on this device.");
      });
    }
  }

  function applyFormState(form, state) {
    var fields = form.elements;
    var index;
    var name;

    for (index = 0; index < fields.length; index += 1) {
      name = fields[index].name;

      if (!name || typeof state[name] === "undefined") {
        continue;
      }

      if (fields[index].type === "radio" || fields[index].type === "checkbox") {
        fields[index].checked = String(state[name]) === String(fields[index].value);
      } else if (fields[index].type !== "file") {
        fields[index].value = state[name];
      }
    }
  }

  function persistFilePreview(form, field) {
    var reader;

    if (!field.files || !field.files.length || field.name !== "profilePhoto") {
      saveFormState(form.id, getFormAnswers(form));
      setSaveStatus(form.id, "Saved on this device.");
      return;
    }

    reader = new FileReader();
    reader.onload = function (event) {
      var state = getFormAnswers(form);
      state.profilePhotoData = event.target.result;
      saveFormState(form.id, state);
      if (form.id === "profileForm") {
        latestProfileAnswers = state;
        saveJson(PROFILE_KEY, state);
        if (profilePreview) {
          profilePreview.innerHTML = buildProfilePreview(state);
        }
        if (dreamProfilePreview) {
          dreamProfilePreview.innerHTML = buildDreamProfilePreview(state);
        }
      }
      setSaveStatus(form.id, "Saved on this device.");
    };
    reader.readAsDataURL(field.files[0]);
  }

  function saveProfileToSupabase(answers) {
    var photoField;

    if (!supabaseClient || !currentSession || !currentSession.user) {
      setSaveStatus("profileForm", "Saved on this device. Log in from Account to sync to Supabase.");
      return;
    }

    setSaveStatus("profileForm", "Saving to your account...");
    photoField = profileForm && profileForm.elements ? profileForm.elements.profilePhoto : null;

    uploadProfilePhotoIfNeeded(photoField, answers).then(function (photoUrl) {
      var payload = {
        user_id: currentSession.user.id,
        email: currentSession.user.email,
        name: answers.name || "",
        username: answers.username || "",
        anonymous: !!answers.anonymous,
        profile_major: answers.profileMajor || "",
        institution: answers.institution || "",
        graduation_year: answers.graduationYear || "",
        career_interests: answers.careerInterests || "",
        job_goal: answers.jobGoal || "",
        excited_about: answers.excitedAbout || "",
        struggling_with: answers.strugglingWith || "",
        profile_photo_url: photoUrl || answers.profilePhotoUrl || "",
        updated_at: new Date().toISOString()
      };

      if (photoUrl) {
        answers.profilePhotoUrl = photoUrl;
        saveJson(PROFILE_KEY, answers);
        saveFormState("profileForm", answers);
      }

      return supabaseClient.from("profiles").upsert(payload, { onConflict: "user_id" });
    }).then(function (result) {
      if (result && result.error) {
        setSaveStatus("profileForm", "Saved locally, but account sync needs attention: " + result.error.message);
        return;
      }

      setSaveStatus("profileForm", "Saved to your account and this device.");
    });
  }

  function uploadProfilePhotoIfNeeded(field, answers) {
    var file;
    var extension;
    var path;

    if (!supabaseClient || !currentSession || !field || !field.files || !field.files.length) {
      return Promise.resolve(answers.profilePhotoUrl || "");
    }

    file = field.files[0];
    extension = file.name && file.name.indexOf(".") !== -1 ? file.name.split(".").pop() : "jpg";
    path = currentSession.user.id + "/profile-" + Date.now() + "." + extension;

    return supabaseClient.storage.from("profile-images").upload(path, file, {
      upsert: true
    }).then(function (uploadResult) {
      var publicResult;

      if (uploadResult.error) {
        return "";
      }

      publicResult = supabaseClient.storage.from("profile-images").getPublicUrl(path);
      return publicResult && publicResult.data ? publicResult.data.publicUrl : "";
    });
  }

  function loadProfileFromSupabase() {
    if (!supabaseClient || !currentSession || !currentSession.user) {
      return;
    }

    supabaseClient.from("profiles").select("*").eq("user_id", currentSession.user.id).maybeSingle().then(function (result) {
      var row;
      var mapped;

      if (!result || result.error || !result.data) {
        return;
      }

      row = result.data;
      mapped = {
        name: row.name || "",
        username: row.username || "",
        anonymous: row.anonymous ? "yes" : "",
        profileMajor: row.profile_major || "",
        institution: row.institution || "",
        graduationYear: row.graduation_year || "",
        careerInterests: row.career_interests || "",
        jobGoal: row.job_goal || "",
        excitedAbout: row.excited_about || "",
        strugglingWith: row.struggling_with || "",
        profilePhotoUrl: row.profile_photo_url || ""
      };

      latestProfileAnswers = mergeObjects(latestProfileAnswers || {}, mapped);
      saveJson(PROFILE_KEY, latestProfileAnswers);
      saveFormState("profileForm", latestProfileAnswers);

      if (profilePreview) {
        profilePreview.innerHTML = buildProfilePreview(latestProfileAnswers);
      }

      if (dreamProfilePreview) {
        dreamProfilePreview.innerHTML = buildDreamProfilePreview(latestProfileAnswers);
      }

      if (profileForm) {
        applyFormState(profileForm, latestProfileAnswers);
      }
    });
  }

  function saveFormState(formId, state) {
    saveJson(FORM_KEY_PREFIX + formId, state);
  }

  function clearFormState(formId) {
    if (window.localStorage) {
      window.localStorage.removeItem(FORM_KEY_PREFIX + formId);
    }
  }

  function saveResponse(formId, html) {
    if (window.localStorage) {
      window.localStorage.setItem(RESPONSE_KEY_PREFIX + formId, html);
    }
  }

  function loadText(key) {
    if (!window.localStorage) {
      return "";
    }

    return window.localStorage.getItem(key) || "";
  }

  function setSaveStatus(formId, message) {
    var status = document.getElementById(formId + "SaveStatus");

    if (status) {
      status.textContent = message;
    }
  }

  function getFeelingAcknowledgement(feeling) {
    if (feeling <= 2) {
      return "it sounds like this season may feel heavy right now.";
    }
    if (feeling === 3) {
      return "it sounds like you’re somewhere in the middle, trying to stay steady.";
    }
    return "it sounds like you still have some hope, even if this process is asking a lot from you.";
  }

  function getPriorityReflection(priority, careerGoals) {
    if (priority === "money") {
      return "A stable income can create breathing room, so it may help to focus on roles connected to " + escapeHtml(careerGoals) + " that are clear about pay and advancement.";
    }
    if (priority === "balance") {
      return "Wanting balance is not a lack of ambition. It can help to look for paths connected to " + escapeHtml(careerGoals) + " with manageable expectations or healthier team norms.";
    }
    if (priority === "growth") {
      return "Prioritizing growth can help you filter for roles connected to " + escapeHtml(careerGoals) + " where you can learn through stretch projects, mentorship, and clear skill-building.";
    }
    if (priority === "purpose") {
      return "Wanting purpose can make the search feel more personal. It may help to focus on roles connected to " + escapeHtml(careerGoals) + " where the mission and day-to-day work both feel meaningful to you.";
    }
    return "Naming what matters most is a useful compass when the search feels noisy.";
  }

  function getNextSteps(answers) {
    var struggle = String(answers.struggle || "").toLowerCase();
    var goals = escapeHtml(answers.careerGoals);
    var priority = readablePriority(answers.priority);
    var steps = [
      "Choose 3 entry-level roles that connect to " + goals + " and match your current experience and your priority around " + escapeHtml(priority) + ". Save the repeated qualifications so you have a clearer target.",
      "Set a 30-minute block to revise one resume section or one LinkedIn section so it supports the kind of work you want after graduating " + escapeHtml(answers.graduationDate) + ".",
      "Reach out to one person each week whose work overlaps with " + goals + " and ask one specific question about how they got started or what matters in hiring."
    ];

    if (containsAny(struggle, ["hear", "response", "reply"])) {
      steps[0] = "Review your last 3 applications and compare them to the job descriptions. Tightening the headline, top skills, and first few bullets can improve how clearly your fit comes across.";
    } else if (containsAny(struggle, ["energy", "burn", "tired"])) {
      steps[1] = "Shrink the process on purpose: pick one job-search task per day for the next week and stop there. Protecting your energy makes it easier to stay consistent.";
    } else if (containsAny(struggle, ["fit", "direction", "know what roles"])) {
      steps[2] = "Make a short list of 5 job titles that could support your goals around " + goals + ", then note which ones feel most aligned with your strengths, your major, and your priority around " + escapeHtml(priority) + ".";
    }

    return steps;
  }

  function getResumeFeedback(answers) {
    var goals = escapeHtml(answers.careerGoals);
    var experience = escapeHtml(answers.experience);
    var accomplishments = escapeHtml(answers.accomplishments);
    var resumeName = answers.resumeFile ? escapeHtml(answers.resumeFile) : "";
    var resumeText = String(answers.resumeText || "");
    var resumeTextLower = resumeText.toLowerCase();
    var feedback = [
      "Lead with experience that connects most clearly to " + goals + ". Even if it came from a part-time job, internship, or volunteer role, focus on the parts that show relevant skills and responsibility.",
      "Turn your experience into impact-focused bullets. For example, show what you improved, supported, organized, or solved: <strong>" + experience + "</strong> can likely be broken into clearer achievement statements.",
      "Make sure your accomplishments and awards are easy to spot. Items like <strong>" + accomplishments + "</strong> can strengthen your credibility when they are tied to effort, recognition, or measurable results."
    ];

    if (resumeName) {
      feedback[0] = "You uploaded <strong>" + resumeName + "</strong>. When revising it, make sure the top third of the page quickly signals your fit for " + goals + " through a focused summary, relevant experience, and strong keywords.";
    }

    if (containsAny(String(answers.experience || "").toLowerCase(), ["volunteer", "intern", "part-time", "part time"])) {
      feedback[1] = "Your experience already counts, even if it came from volunteer work, internships, or part-time roles. Frame those entries around transferable skills like communication, initiative, organization, leadership, or reliability.";
    }

    if (containsAny(String(answers.accomplishments || "").toLowerCase(), ["award", "dean", "scholar", "honor", "honour", "recogn"])) {
      feedback[2] = "Since you listed recognition like <strong>" + accomplishments + "</strong>, give it a dedicated line or small section so employers can quickly see evidence of achievement and trust in your work.";
    }

    if (resumeText) {
      feedback[0] = "Since you pasted your resume text, check whether the first few lines clearly connect you to " + goals + ". The opening should quickly show what kind of work you want and what strengths you already bring.";
      feedback[1] = getResumeTextSpecificFeedback(resumeTextLower, experience, goals);
      feedback[2] = getResumeStructureFeedback(resumeTextLower, accomplishments);
    }

    return feedback;
  }

  function getResumeTextSpecificFeedback(resumeTextLower, experience, goals) {
    if (!containsAny(resumeTextLower, ["managed", "created", "organized", "improved", "led", "supported", "developed", "coordinated"])) {
      return "Your pasted resume may need stronger action language. Revise a few bullets so they begin with direct verbs like managed, coordinated, created, supported, or improved, especially in the sections tied to " + goals + ".";
    }
    if (!containsAny(resumeTextLower, ["%", "increased", "reduced", "grew", "raised", "served", "trained", "completed"])) {
      return "Your resume text could be stronger with clearer outcomes. Add scope or results where you can. Your experience in <strong>" + experience + "</strong> likely has more measurable detail than you may think.";
    }
    return "Your resume already includes some solid experience language. Next, tighten any bullets that feel too general so they more clearly show how your work connects to " + goals + ".";
  }

  function getResumeStructureFeedback(resumeTextLower, accomplishments) {
    if (!containsAny(resumeTextLower, ["education", "experience", "skills"])) {
      return "Consider making the structure more scannable with clear section headings like Education, Experience, and Skills so a recruiter can find key information quickly.";
    }
    if (!containsAny(resumeTextLower, ["award", "honor", "honour", "dean", "scholar"])) {
      return "If you have accomplishments like <strong>" + accomplishments + "</strong>, make sure they appear in the resume itself rather than staying only in your notes.";
    }
    return "Your resume structure already has some core pieces. Keep your most relevant experience near the top and make sure accomplishments like <strong>" + accomplishments + "</strong> are easy to notice.";
  }

  function getFridayReflection(applications, interviews, stepsCompleted) {
    if (applications === 0 && interviews === 0 && stepsCompleted === 0) {
      return "This may have been a quieter week, and that does not mean you are failing. Sometimes progress looks like pausing, regrouping, and getting ready to start again.";
    }
    if (interviews > 0) {
      return "That is real progress, even if the process still feels uncertain. A response like that can be a helpful reminder that your effort is reaching actual people.";
    }
    if (stepsCompleted === 3) {
      return "That shows real consistency. Even when results are not immediate, following through on your plan matters more than it may feel in the moment.";
    }
    if (applications > 0 || stepsCompleted > 0) {
      return "That is still meaningful progress. Job searching often moves more slowly than people expect, so small steady action is worth noticing.";
    }
    return "This is completely normal. Job searching can move unevenly, and taking stock of the week can help you reset without being hard on yourself.";
  }

  function getFridayNextSteps(applications, interviews, stepsCompleted) {
    var suggestions = [
      "Apply to 3-5 targeted roles",
      "Improve one resume section",
      "Reach out to one person in your field"
    ];

    if (applications === 0) {
      suggestions[0] = "Choose 3 roles that fit your goals and submit focused applications";
    }
    if (interviews > 0) {
      suggestions[1] = "Review one interview takeaway and strengthen one story you can reuse next time";
    }
    if (stepsCompleted <= 1) {
      suggestions[2] = "Pick one small networking step so next week feels more manageable";
    }

    return suggestions;
  }

  function containsAny(text, parts) {
    var index;
    for (index = 0; index < parts.length; index += 1) {
      if (text.indexOf(parts[index]) !== -1) {
        return true;
      }
    }
    return false;
  }

  function readablePriority(priority) {
    if (priority === "money") {
      return "money";
    }
    if (priority === "balance") {
      return "work-life balance";
    }
    if (priority === "growth") {
      return "growth";
    }
    if (priority === "purpose") {
      return "purpose";
    }
    return "your priorities";
  }

  function appendChatBubble(type, message) {
    var bubble;
    if (!lumaChatWindow) {
      return;
    }
    bubble = document.createElement("div");
    bubble.className = "chat-bubble " + type;
    bubble.textContent = message;
    lumaChatWindow.appendChild(bubble);
  }

  function makeList(items, tag) {
    var html = "<" + tag + ">";
    var index;
    for (index = 0; index < items.length; index += 1) {
      html += "<li>" + items[index] + "</li>";
    }
    html += "</" + tag + ">";
    return html;
  }

  function pluralize(count) {
    return count === 1 ? "" : "s";
  }

  function getDisplayName(answers) {
    if (answers.anonymous) {
      if (answers.username) {
        return "@" + answers.username;
      }
      return "Anonymous member";
    }

    return answers.name || answers.username || "New grad";
  }

  function buildProfileAvatar(answers, displayName) {
    var initial;

    if (answers.profilePhotoData) {
      return "<img class='profile-avatar' src='" + escapeAttribute(answers.profilePhotoData) + "' alt='Profile picture for " + escapeAttribute(displayName) + "' />";
    }

    if (answers.profilePhotoUrl) {
      return "<img class='profile-avatar' src='" + escapeAttribute(answers.profilePhotoUrl) + "' alt='Profile picture for " + escapeAttribute(displayName) + "' />";
    }

    initial = displayName ? displayName.charAt(0).toUpperCase() : "S";
    return "<div class='profile-avatar'>" + escapeHtml(initial) + "</div>";
  }

  function firstWord(value) {
    var trimmed = String(value || "").replace(/^\s+|\s+$/g, "");
    var parts;

    if (!trimmed) {
      return "";
    }

    parts = trimmed.split(/\s+/);
    return parts[0];
  }

  function formatParagraphs(value) {
    var lines = String(value || "").replace(/\r/g, "").split("\n");
    var parts = [];
    var index;
    var line;

    for (index = 0; index < lines.length; index += 1) {
      line = lines[index].replace(/^\s+|\s+$/g, "");
      if (line) {
        parts.push(escapeHtml(line));
      }
    }

    if (!parts.length) {
      return "";
    }

    return parts.join("<br /><br />");
  }

  function mergeObjects(base, overrides) {
    var merged = {};
    var key;

    base = base || {};
    overrides = overrides || {};

    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) {
        merged[key] = base[key];
      }
    }

    for (key in overrides) {
      if (Object.prototype.hasOwnProperty.call(overrides, key) && overrides[key] !== "") {
        merged[key] = overrides[key];
      }
    }

    return merged;
  }

  function createSupabaseClient() {
    var config = window.STEADY_STEPS_SUPABASE;

    if (!window.supabase || !config || !config.url || !config.anonKey) {
      return null;
    }

    if (config.url === PLACEHOLDER_SUPABASE_URL || config.anonKey === PLACEHOLDER_SUPABASE_KEY) {
      return null;
    }

    return window.supabase.createClient(config.url, config.anonKey);
  }

  function saveJson(key, value) {
    if (window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }

  function loadJson(key) {
    if (!window.localStorage) {
      return null;
    }
    try {
      return JSON.parse(window.localStorage.getItem(key) || "null");
    } catch (error) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
}());
