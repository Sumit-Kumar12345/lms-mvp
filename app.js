// 1. YOUR FIREBASE CONFIGURATION (Paste your config here)
const firebaseConfig = {
  apiKey: "AIzaSyA495fxS2zaf93-lWqdhlqMGQJDKKl8VmE",
  authDomain: "library-mvp.firebaseapp.com",
  projectId: "library-mvp",
  storageBucket: "library-mvp.firebasestorage.app",
  messagingSenderId: "571898781180",
  appId: "1:571898781180:web:34d9dbd4553a6e77c02679",
  measurementId: "G-L4M6NTMS1X"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global State
let currentUser = null;
let currentRole = null;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const dashboard = document.getElementById('dashboard');
const librarianPanel = document.getElementById('librarian-panel');
const availableBooksList = document.getElementById('available-books');
const borrowedBooksList = document.getElementById('borrowed-books');
const errorMsg = document.getElementById('auth-error');

// --- AUTHENTICATION ---

async function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    errorMsg.innerText = "";

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        // Save user role in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({ email, role });
    } catch (error) {
        errorMsg.innerText = error.message;
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    errorMsg.innerText = "";

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        errorMsg.innerText = error.message;
    }
}

function logout() {
    auth.signOut();
}

// Listen for auth state changes
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        // Fetch user role
        const doc = await db.collection('users').doc(user.uid).get();
        currentRole = doc.exists ? doc.data().role : 'student'; // Default to student
        
        // Update UI
        document.getElementById('user-email').innerText = user.email;
        document.getElementById('user-role').innerText = currentRole;
        
        authScreen.classList.add('hidden');
        dashboard.classList.remove('hidden');

        if (currentRole === 'librarian') {
            librarianPanel.classList.remove('hidden');
            document.getElementById('borrowed-title').innerText = "All Borrowed Books";
        } else {
            librarianPanel.classList.add('hidden');
            document.getElementById('borrowed-title').innerText = "My Borrowed Books";
        }

        listenToBooks(); // Start real-time syncing
    } else {
        currentUser = null;
        currentRole = null;
        authScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
    }
});

// --- CORE LOGIC ---

async function addBook() {
    const title = document.getElementById('book-title').value;
    const author = document.getElementById('book-author').value;

    if (!title || !author) {
        alert("Please fill in both fields");
        return;
    }

    try {
        await db.collection('books').add({
            title: title,
            author: author,
            status: 'available', // available or borrowed
            borrowedBy: null,
            borrowerEmail: null,
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('book-title').value = '';
        document.getElementById('book-author').value = '';
    } catch (error) {
        console.error("Error adding book:", error);
    }
}

async function borrowBook(bookId) {
    try {
        await db.collection('books').doc(bookId).update({
            status: 'borrowed',
            borrowedBy: currentUser.uid,
            borrowerEmail: currentUser.email
        });
    } catch (error) {
        console.error("Error borrowing book:", error);
    }
}

async function returnBook(bookId) {
    try {
        await db.collection('books').doc(bookId).update({
            status: 'available',
            borrowedBy: null,
            borrowerEmail: null
        });
    } catch (error) {
        console.error("Error returning book:", error);
    }
}

// --- REAL-TIME NOTIFICATIONS (onSnapshot) ---

function listenToBooks() {
    // This function automatically runs whenever the 'books' collection changes
    db.collection('books').onSnapshot((snapshot) => {
        availableBooksList.innerHTML = '';
        borrowedBooksList.innerHTML = '';

        snapshot.forEach((doc) => {
            const book = doc.data();
            const bookId = doc.id;
            
            const li = document.createElement('li');
            
            if (book.status === 'available') {
                let html = `<span><strong>${book.title}</strong> by ${book.author}</span>`;
                // Only students can borrow
                if (currentRole === 'student') {
                    html += `<button class="action-btn" onclick="borrowBook('${bookId}')">Borrow</button>`;
                }
                li.innerHTML = html;
                availableBooksList.appendChild(li);
            } 
            else if (book.status === 'borrowed') {
                // If Student, only show THEIR borrowed books. If Librarian, show ALL.
                if (currentRole === 'librarian' || book.borrowedBy === currentUser.uid) {
                    let html = `<span><strong>${book.title}</strong> by ${book.author} <br> <small>(Borrowed by ${book.borrowerEmail})</small></span>`;
                    // Only librarians can mark as returned
                    if (currentRole === 'librarian') {
                        html += `<button class="action-btn secondary" onclick="returnBook('${bookId}')">Mark Returned</button>`;
                    }
                    li.innerHTML = html;
                    borrowedBooksList.appendChild(li);
                }
            }
        });
    });
}