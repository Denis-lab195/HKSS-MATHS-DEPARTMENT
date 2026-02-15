// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCSv-qp0XaFPeN3zpOyuKHAiILDIlCQ0Dc",
    authDomain: "school-281ff.firebaseapp.com",
    databaseURL: "https://school-281ff-default-rtdb.firebaseio.com",
    projectId: "school-281ff",
    storageBucket: "school-281ff.firebasestorage.app",
    messagingSenderId: "623145317447",
    appId: "1:623145317447:web:edefdbb896625317196d62",
    measurementId: "G-JBJV9K0890"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();