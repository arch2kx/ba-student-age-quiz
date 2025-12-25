// Global variables
let students = [];
let quizSettings = {};
let currentQuestionIndex = 0;
let score = 0;
let quizQuestions = [];
let userAnswers = [];

// DOM elements
const setupScreen = document.getElementById('setup-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');
const startBtn = document.getElementById('start-btn');
const loadingDiv = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');

// Event listeners
startBtn.addEventListener('click', startQuiz);
restartBtn.addEventListener('click', resetQuiz);
themeToggle.addEventListener('click', toggleTheme);

// Theme toggle functionality
function toggleTheme() {
    const body = document.body;
    const themeIcon = themeToggle.querySelector('.theme-icon');

    body.classList.toggle('dark-mode');

    // Update icon
    if (body.classList.contains('dark-mode')) {
        themeIcon.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    } else {
        themeIcon.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    }
}

// Load saved theme on page load
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = themeToggle.querySelector('.theme-icon');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.textContent = '☀️';
    } else {
        themeIcon.textContent = '🌙';
    }
}

// Fetch student data from SchaleDB
async function fetchStudentData() {
    try {
        loadingDiv.classList.remove('hidden');
        errorMessage.classList.add('hidden');

        // Using SchaleDB's GitHub data repository
        const response = await fetch('https://raw.githubusercontent.com/lonqie/SchaleDB/main/data/en/students.json');

        if (!response.ok) {
            throw new Error('Failed to fetch student data');
        }

        const data = await response.json();

        // Convert object to array if needed
        let studentsArray = Array.isArray(data) ? data : Object.values(data);

        console.log('Total students loaded:', studentsArray.length);
        console.log('Sample student:', studentsArray[0]);

        // Filter students that have age data (check multiple possible field names)
        students = studentsArray.filter(student => {
            const age = student.Age || student.age || student.CharacterAge;
            return age && age !== 'Unknown' && age !== '?' && !isNaN(parseInt(age));
        });

        console.log('Students with valid age:', students.length);

        if (students.length === 0) {
            throw new Error('No valid student data found');
        }

        loadingDiv.classList.add('hidden');
        return true;
    } catch (error) {
        console.error('Error fetching data:', error);
        loadingDiv.classList.add('hidden');
        errorMessage.textContent = `Error loading student data: ${error.message}. Please try again.`;
        errorMessage.classList.remove('hidden');
        return false;
    }
}

// Start the quiz
async function startQuiz() {
    // Get settings
    quizSettings = {
        numQuestions: parseInt(document.getElementById('num-questions').value),
        answerType: document.getElementById('answer-type').value,
        studentOrder: document.getElementById('student-order').value
    };

    // Fetch data if not already loaded
    if (students.length === 0) {
        const success = await fetchStudentData();
        if (!success) return;
    }

    // Prepare quiz questions
    prepareQuizQuestions();

    // Reset quiz state
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];

    // Show quiz screen
    setupScreen.classList.remove('active');
    quizScreen.classList.add('active');

    // Display first question
    displayQuestion();
}

// Prepare quiz questions based on settings
function prepareQuizQuestions() {
    let selectedStudents = [...students];

    // Sort students based on preference
    if (quizSettings.studentOrder === 'popular') {
        // If there's a popularity metric, use it. Otherwise random.
        // SchaleDB might have stats - for now using random as fallback
        selectedStudents = shuffleArray(selectedStudents);
    } else if (quizSettings.studentOrder === 'unpopular') {
        selectedStudents = shuffleArray(selectedStudents).reverse();
    } else {
        selectedStudents = shuffleArray(selectedStudents);
    }

    // Select the number of questions requested
    quizQuestions = selectedStudents.slice(0, Math.min(quizSettings.numQuestions, selectedStudents.length));
}

// Display current question
function displayQuestion() {
    const question = quizQuestions[currentQuestionIndex];

    // Update progress
    document.getElementById('current-question').textContent = currentQuestionIndex + 1;
    document.getElementById('total-questions').textContent = quizQuestions.length;
    document.getElementById('current-score').textContent = score;

    // Display student info
    const studentImage = document.getElementById('student-image');
    const studentName = document.getElementById('student-name');

    // Set student image (using SchaleDB image path)
    studentImage.src = `https://schaledb.com/images/student/collection/${question.Id}.webp`;
    studentImage.alt = question.Name;
    studentName.textContent = question.Name;

    // Hide feedback
    document.getElementById('feedback').classList.add('hidden');

    // Display answer options based on type
    const answerContainer = document.getElementById('answer-container');
    answerContainer.innerHTML = '';

    if (quizSettings.answerType === 'multiple-choice') {
        answerContainer.className = 'answer-container multiple-choice';
        displayMultipleChoice(question);
    } else {
        answerContainer.className = 'answer-container type-in';
        displayTypeIn(question);
    }
}

// Display multiple choice options
function displayMultipleChoice(question) {
    const correctAge = getStudentAge(question);
    const answerContainer = document.getElementById('answer-container');

    // Generate options (correct age + 3 random ages)
    const options = new Set([correctAge]);

    while (options.size < 4) {
        const randomAge = correctAge + Math.floor(Math.random() * 7) - 3; // ±3 years
        if (randomAge > 0 && randomAge <= 25) { // Reasonable age range
            options.add(randomAge);
        }
    }

    const optionsArray = shuffleArray([...options]);

    optionsArray.forEach(age => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = `${age} years old`;
        button.dataset.age = age;
        button.addEventListener('click', () => checkAnswer(age, correctAge, button));
        answerContainer.appendChild(button);
    });
}

// Display type-in input
function displayTypeIn(question) {
    const answerContainer = document.getElementById('answer-container');

    const group = document.createElement('div');
    group.className = 'type-in-group';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'type-in-input';
    input.placeholder = 'Enter age';
    input.min = '1';
    input.max = '25';
    input.id = 'age-input';

    const submitBtn = document.createElement('button');
    submitBtn.className = 'submit-answer-btn';
    submitBtn.textContent = 'Submit';
    submitBtn.addEventListener('click', () => {
        const userAge = parseInt(input.value);
        if (!isNaN(userAge)) {
            const correctAge = getStudentAge(question);
            checkAnswer(userAge, correctAge, submitBtn);
        }
    });

    // Allow Enter key to submit
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitBtn.click();
        }
    });

    group.appendChild(input);
    group.appendChild(submitBtn);
    answerContainer.appendChild(group);

    input.focus();
}

// Check answer
function checkAnswer(userAge, correctAge, buttonElement) {
    const isCorrect = userAge === correctAge;

    // Record answer
    userAnswers.push({
        student: quizQuestions[currentQuestionIndex],
        userAnswer: userAge,
        correctAnswer: correctAge,
        isCorrect: isCorrect
    });

    if (isCorrect) {
        score++;
    }

    // Update score display
    document.getElementById('current-score').textContent = score;

    // Show feedback
    const feedback = document.getElementById('feedback');
    const feedbackText = document.getElementById('feedback-text');

    if (isCorrect) {
        feedback.className = 'feedback correct';
        feedbackText.innerHTML = `<strong>✅ Correct!</strong><br>${quizQuestions[currentQuestionIndex].Name} is ${correctAge} years old.`;
    } else {
        feedback.className = 'feedback incorrect';
        feedbackText.innerHTML = `<strong>❌ Incorrect!</strong><br>You guessed ${userAge}, but ${quizQuestions[currentQuestionIndex].Name} is ${correctAge} years old.`;
    }

    feedback.classList.remove('hidden');

    // Disable all answer buttons
    if (quizSettings.answerType === 'multiple-choice') {
        const buttons = document.querySelectorAll('.answer-btn');
        buttons.forEach(btn => {
            btn.disabled = true;
            if (parseInt(btn.dataset.age) === correctAge) {
                btn.classList.add('correct');
            } else if (btn === buttonElement && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });
    } else {
        buttonElement.disabled = true;
        document.getElementById('age-input').disabled = true;
    }

    // Setup next button
    const nextBtn = document.getElementById('next-btn');
    nextBtn.onclick = nextQuestion;
}

// Move to next question
function nextQuestion() {
    currentQuestionIndex++;

    if (currentQuestionIndex < quizQuestions.length) {
        displayQuestion();
    } else {
        showResults();
    }
}

// Show final results
function showResults() {
    quizScreen.classList.remove('active');
    resultsScreen.classList.add('active');

    const finalScore = document.getElementById('final-score');
    const finalTotal = document.getElementById('final-total');
    const percentage = document.getElementById('percentage');

    finalScore.textContent = score;
    finalTotal.textContent = quizQuestions.length;
    percentage.textContent = Math.round((score / quizQuestions.length) * 100);

    // Display detailed results
    const resultsDetails = document.getElementById('results-details');
    resultsDetails.innerHTML = '';

    userAnswers.forEach((answer, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${answer.isCorrect ? 'correct-answer' : 'incorrect-answer'}`;

        resultItem.innerHTML = `
            <img src="https://schaledb.com/images/student/collection/${answer.student.Id}.webp" alt="${answer.student.Name}">
            <div class="result-info">
                <strong>${answer.student.Name}</strong>
                <span>Your answer: ${answer.userAnswer} | Correct answer: ${answer.correctAnswer}</span>
            </div>
            <div class="result-status ${answer.isCorrect ? 'correct' : 'incorrect'}">
                ${answer.isCorrect ? '✓' : '✗'}
            </div>
        `;

        resultsDetails.appendChild(resultItem);
    });
}

// Reset quiz
function resetQuiz() {
    resultsScreen.classList.remove('active');
    setupScreen.classList.add('active');

    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    quizQuestions = [];
}

// Utility function to shuffle array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Helper function to get student age
function getStudentAge(student) {
    return parseInt(student.Age || student.age || student.CharacterAge);
}

// Initialize on page load
window.addEventListener('load', () => {
    loadTheme();
    // Optionally preload data
    // fetchStudentData();
});
