// ============================================================
// CHRONICAI — REGISTER / CREATE CITIZEN ACCOUNT
// ============================================================
// FLOW:
//
// Register Form
//      ↓
// Validate Form
//      ↓
// Firebase Authentication
//      ↓
// Create Email + Password Account
//      ↓
// Save Display Name
//      ↓
// Save Citizen Profile
//      ↓
// Sign Out Temporary Firebase Session
//      ↓
// Redirect → login.html
//
// IMPORTANT:
// Password is NEVER stored in Realtime Database.
// Firebase Authentication manages the password securely.
// ============================================================

"use strict";

// ============================================================
// FIREBASE IMPORT
// ============================================================

import {
    createUserWithEmailAndPassword,
    updateProfile,
    signOut
} from "firebase/auth";

import {
    ref,
    set
} from "firebase/database";

import {
    auth,
    database
} from "./firebase.js";

// ============================================================
// DOM ELEMENTS
// ============================================================

const registerForm =
    document.getElementById("registerForm");

const registerButton =
    document.getElementById("registerButton");

const registerMessage =
    document.getElementById("registerMessage");

const nameInput =
    document.getElementById("name");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const confirmPasswordInput =
    document.getElementById("confirmPassword");

const termsInput =
    document.getElementById("terms");

// ============================================================
// CHECK REQUIRED HTML
// ============================================================

if (!registerForm) {
    console.error(
        "ChronicAI ERROR: registerForm was not found."
    );
}

if (!registerButton) {
    console.error(
        "ChronicAI ERROR: registerButton was not found."
    );
}

if (!nameInput) {
    console.error(
        "ChronicAI ERROR: name input was not found."
    );
}

if (!emailInput) {
    console.error(
        "ChronicAI ERROR: email input was not found."
    );
}

if (!passwordInput) {
    console.error(
        "ChronicAI ERROR: password input was not found."
    );
}

if (!confirmPasswordInput) {
    console.error(
        "ChronicAI ERROR: confirmPassword input was not found."
    );
}

// ============================================================
// SHOW MESSAGE
// ============================================================

function showMessage(
    message,
    success = false
) {

    if (!registerMessage) {

        console.log(
            message
        );

        return;
    }

    registerMessage.textContent =
        message;

    registerMessage.style.color =
        success
            ? "#35e69a"
            : "#ff6b6b";
}

// ============================================================
// PASSWORD TOGGLE
// ============================================================

function setupPasswordToggle(
    buttonId,
    inputId
) {

    const button =
        document.getElementById(
            buttonId
        );

    const input =
        document.getElementById(
            inputId
        );

    if (
        !button ||
        !input
    ) {
        return;
    }

    button.addEventListener(
        "click",
        () => {

            const icon =
                button.querySelector(
                    "i"
                );

            if (
                input.type ===
                "password"
            ) {

                input.type =
                    "text";

                if (icon) {

                    icon.className =
                        "fa-solid fa-eye-slash";
                }

                button.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            } else {

                input.type =
                    "password";

                if (icon) {

                    icon.className =
                        "fa-solid fa-eye";
                }

                button.setAttribute(
                    "aria-label",
                    "Show password"
                );
            }
        }
    );
}

// ============================================================
// ENABLE PASSWORD TOGGLES
// ============================================================

setupPasswordToggle(
    "passwordToggle",
    "password"
);

setupPasswordToggle(
    "confirmPasswordToggle",
    "confirmPassword"
);

// ============================================================
// BUTTON LOADING
// ============================================================

function setLoading(
    loading
) {

    if (!registerButton) {
        return;
    }

    if (loading) {

        registerButton.disabled =
            true;

        registerButton.innerHTML =
            `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Creating Account...
            `;

    } else {

        registerButton.disabled =
            false;

        registerButton.innerHTML =
            `
            <i class="fa-solid fa-user-plus"></i>
            Create Citizen Account
            `;
    }
}

// ============================================================
// NORMALIZE EMAIL
// ============================================================

function normalizeEmail(
    email
) {

    return String(
        email || ""
    )
        .trim()
        .toLowerCase();
}

// ============================================================
// NORMALIZE NAME
// ============================================================

function normalizeName(
    name
) {

    return String(
        name || ""
    )
        .trim()
        .replace(
            /\s+/g,
            " "
        )
        .slice(
            0,
            150
        );
}

// ============================================================
// VALIDATE EMAIL
// ============================================================

function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
}

// ============================================================
// FIREBASE ERROR MESSAGE
// ============================================================

function getFirebaseErrorMessage(
    error
) {

    const code =
        error?.code ||
        "";

    switch (code) {

        case "auth/email-already-in-use":

            return (
                "This email is already registered. Please login."
            );

        case "auth/invalid-email":

            return (
                "Please enter a valid email address."
            );

        case "auth/weak-password":

            return (
                "Password is too weak. Use at least 6 characters."
            );

        case "auth/operation-not-allowed":

            return (
                "Email/Password authentication is not enabled in Firebase."
            );

        case "auth/network-request-failed":

            return (
                "Network error. Please check your internet connection."
            );

        case "auth/too-many-requests":

            return (
                "Too many attempts. Please wait and try again."
            );

        case "auth/invalid-api-key":

            return (
                "Firebase configuration is invalid."
            );

        case "auth/unauthorized-domain":

            return (
                "This website domain is not authorized in Firebase."
            );

        case "PERMISSION_DENIED":

            return (
                "Database permission denied. Check your Firebase Realtime Database Rules."
            );

        default:

            if (
                error?.message
                    ?.toLowerCase()
                    .includes(
                        "permission_denied"
                    )
            ) {

                return (
                    "Database permission denied. Check your Firebase Realtime Database Rules."
                );
            }

            return (
                error?.message ||
                "Registration failed. Please try again."
            );
    }
}

// ============================================================
// CLEAR OLD LOGIN SESSION
// ============================================================
//
// Important:
//
// যদি আগের কোনো session থেকে থাকে,
// registration page-এ নতুন account তৈরি করার আগে
// সেটা পরিষ্কার করা হবে।
// ============================================================

function clearOldSession() {

    localStorage.removeItem(
        "chronicAIUser"
    );

    localStorage.removeItem(
        "chronicAILoggedIn"
    );

    localStorage.removeItem(
        "chronicAIUserId"
    );

    localStorage.removeItem(
        "chronicAIUserEmail"
    );

    localStorage.removeItem(
        "chronicAIUserName"
    );
}

// ============================================================
// REGISTER USER
// ============================================================

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            // =================================================
            // CLEAR PREVIOUS SESSION
            // =================================================

            clearOldSession();

            // =================================================
            // GET FORM VALUES
            // =================================================

            const name =
                normalizeName(
                    nameInput?.value
                );

            const email =
                normalizeEmail(
                    emailInput?.value
                );

            const password =
                passwordInput?.value ||
                "";

            const confirmPassword =
                confirmPasswordInput?.value ||
                "";

            const termsAccepted =
                termsInput
                    ? termsInput.checked
                    : false;

            // =================================================
            // NAME VALIDATION
            // =================================================

            if (!name) {

                showMessage(
                    "Please enter your full name."
                );

                nameInput?.focus();

                return;
            }

            if (
                name.length < 2
            ) {

                showMessage(
                    "Please enter a valid name."
                );

                nameInput?.focus();

                return;
            }

            // =================================================
            // EMAIL VALIDATION
            // =================================================

            if (!email) {

                showMessage(
                    "Please enter your email address."
                );

                emailInput?.focus();

                return;
            }

            if (
                !isValidEmail(
                    email
                )
            ) {

                showMessage(
                    "Please enter a valid email address."
                );

                emailInput?.focus();

                return;
            }

            // =================================================
            // PASSWORD VALIDATION
            // =================================================

            if (
                password.length < 6
            ) {

                showMessage(
                    "Password must be at least 6 characters."
                );

                passwordInput?.focus();

                return;
            }

            // =================================================
            // CONFIRM PASSWORD
            // =================================================

            if (
                password !==
                confirmPassword
            ) {

                showMessage(
                    "Passwords do not match."
                );

                confirmPasswordInput?.focus();

                return;
            }

            // =================================================
            // TERMS
            // =================================================

            if (
                termsInput &&
                !termsAccepted
            ) {

                showMessage(
                    "Please accept the Terms and Privacy Policy."
                );

                return;
            }

            // =================================================
            // START LOADING
            // =================================================

            setLoading(
                true
            );

            showMessage(
                "Creating your ChronicAI citizen account..."
            );

            try {

                // =================================================
                // 1. CREATE FIREBASE AUTH ACCOUNT
                // =================================================

                console.log(
                    "ChronicAI: Creating Firebase Authentication account..."
                );

                const userCredential =
                    await createUserWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                const user =
                    userCredential.user;

                if (!user) {

                    throw new Error(
                        "Firebase did not return a user account."
                    );
                }

                console.log(
                    "ChronicAI: Firebase account created:",
                    user.uid
                );

                // =================================================
                // 2. SAVE DISPLAY NAME
                // =================================================

                try {

                    await updateProfile(
                        user,
                        {
                            displayName:
                                name
                        }
                    );

                } catch (
                    profileError
                ) {

                    console.warn(
                        "ChronicAI: Display name update failed:",
                        profileError
                    );
                }

                // =================================================
                // 3. CREATE CITIZEN PROFILE
                // =================================================

                const userProfile = {

                    uid:
                        user.uid,

                    name:
                        name,

                    email:
                        email,

                    role:
                        "citizen",

                    accountStatus:
                        "active",

                    createdAt:
                        new Date()
                            .toISOString(),

                    lastLoginAt:
                        null,

                    totalReports:
                        0
                };

                // =================================================
                // 4. SAVE PROFILE
                // =================================================

                console.log(
                    "ChronicAI: Saving citizen profile..."
                );

                await set(
                    ref(
                        database,
                        `users/${user.uid}`
                    ),
                    userProfile
                );

                console.log(
                    "ChronicAI: Citizen profile saved."
                );

                // =================================================
                // 5. SAVE ONLY REGISTRATION INFO
                // =================================================
                //
                // IMPORTANT:
                //
                // এখানে loggedIn=true রাখা হচ্ছে না।
                //
                // কারণ user এখনো Login করেনি।
                //
                // =================================================

                localStorage.setItem(
                    "chronicAIRegisteredEmail",
                    email
                );

                localStorage.setItem(
                    "chronicAIRegisteredName",
                    name
                );

                // =================================================
                // 6. SUCCESS MESSAGE
                // =================================================

                showMessage(
                    "Account created successfully! Redirecting to Login...",
                    true
                );

                registerButton.disabled =
                    true;

                registerButton.innerHTML =
                    `
                    <i class="fa-solid fa-check"></i>
                    Account Created
                    `;

                // =================================================
                // 7. SIGN OUT
                // =================================================
                //
                // Firebase automatically signs the new account in
                // after createUserWithEmailAndPassword().
                //
                // কিন্তু required flow:
                //
                // REGISTER → LOGIN
                //
                // তাই temporary Firebase session sign out করছি।
                // =================================================

                try {

                    await signOut(
                        auth
                    );

                } catch (
                    signOutError
                ) {

                    console.warn(
                        "ChronicAI: Temporary registration session could not be signed out:",
                        signOutError
                    );
                }

                // =================================================
                // 8. REDIRECT TO LOGIN
                // =================================================

                setTimeout(
                    () => {

                        window.location.href =
                            "login.html?registered=true";

                    },
                    900
                );

            } catch (
                error
            ) {

                console.error(
                    "ChronicAI Registration Error:",
                    error
                );

                // =================================================
                // SHOW ERROR
                // =================================================

                showMessage(
                    getFirebaseErrorMessage(
                        error
                    )
                );

                // =================================================
                // RESET BUTTON
                // =================================================

                setLoading(
                    false
                );

                // =================================================
                // ALREADY REGISTERED
                // =================================================

                if (
                    error?.code ===
                    "auth/email-already-in-use"
                ) {

                    setTimeout(
                        () => {

                            window.location.href =
                                "login.html";

                        },
                        1800
                    );
                }
            }
        }
    );
}

// ============================================================
// PAGE READY
// ============================================================

console.log(
    "================================================"
);

console.log(
    "CHRONICAI REGISTER MODULE READY"
);

console.log(
    "Firebase Authentication: READY"
);

console.log(
    "Realtime Database: READY"
);

console.log(
    "Registration Flow: REGISTER → LOGIN"
);

console.log(
    "Password Storage: FIREBASE AUTH ONLY"
);

console.log(
    "================================================"
);