// صفحة المصادقة
let currentStep = 'email';
let currentEmail = '';
let storedNewOtp = '';

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupForms();

    if (isLoggedIn()) {
        redirectToDashboard();
    }
});

function setupTabs() {
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    });

    signupTab.addEventListener('click', () => {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });
}

function setupForms() {
    const loginFormElement = document.getElementById('loginFormElement');
    const signupFormElement = document.getElementById('signupFormElement');

    loginFormElement.addEventListener('submit', handleLogin);
    signupFormElement.addEventListener('submit', handleSignup);
}

async function handleLogin(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('loginSubmitBtn');
    const email = document.getElementById('loginEmail').value;
    const otpSection = document.getElementById('loginOtpSection');
    const otpInput = document.getElementById('loginOtp');

    if (currentStep === 'email') {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جارٍ إرسال رمز التحقق...';

        try {
            await apiCall(API_ENDPOINTS.otpRequest, 'POST', { email }, false);

            currentEmail = email;
            currentStep = 'otp';

            otpSection.classList.remove('hidden');
            submitBtn.textContent = 'تحقق وتسجيل الدخول';
            submitBtn.disabled = false;

            showMessage('تم إرسال رمز التحقق! تحقق من وحدة التحكم.', 'success');
        } catch (error) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'طلب رمز التحقق';
            showMessage(error.error || 'فشل إرسال رمز التحقق', 'error');
        }
    } else {
        const otpCode = otpInput.value;

        if (!otpCode || otpCode.length !== 6) {
            showMessage('يرجى إدخال رمز تحقق مكوّن من 6 أرقام', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'جارٍ التحقق...';

        try {
            const result = await apiCall(API_ENDPOINTS.otpVerify, 'POST', {
                email: currentEmail,
                otp_code: otpCode
            }, false);

            localStorage.setItem('access_token', result.access);
            localStorage.setItem('refresh_token', result.refresh);
            localStorage.setItem('user', JSON.stringify(result.user));

            submitBtn.textContent = 'تم بنجاح!';
            showMessage('تم تسجيل الدخول بنجاح! جارٍ التحويل...', 'success');

            setTimeout(() => {
                redirectToDashboard();
            }, 1000);
        } catch (error) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'تحقق وتسجيل الدخول';
            showMessage(error.error || 'فشل التحقق من الرمز', 'error');
        }
    }
}

async function handleSignup(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');

    const formData = {
        email: document.getElementById('signupEmail').value,
        full_name: document.getElementById('signupName').value,
        phone_number: document.getElementById('signupPhone').value,
        birth_date: document.getElementById('signupBirth').value,
        gender: document.getElementById('signupGender').value,
        chronic_diseases: document.getElementById('signupDiseases').value || ''
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'جارٍ إنشاء الحساب...';

    try {
        await apiCall(API_ENDPOINTS.signup, 'POST', formData, false);

        showMessage('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.', 'success');

        setTimeout(() => {
            document.getElementById('loginTab').click();
            document.getElementById('loginEmail').value = formData.email;
        }, 1500);

        submitBtn.disabled = false;
        submitBtn.textContent = 'إنشاء حساب';
        e.target.reset();
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'إنشاء حساب';

        let errorMsg = 'فشل إنشاء الحساب';
        if (error.email) errorMsg = error.email[0];
        else if (error.phone_number) errorMsg = error.phone_number[0];

        showMessage(errorMsg, 'error');
    }
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('authMessage');
    messageDiv.textContent = message;
    messageDiv.className = `auth-message ${type}`;
    messageDiv.classList.remove('hidden');

    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}
