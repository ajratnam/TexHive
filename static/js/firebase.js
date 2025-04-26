// Initialize Firebase with configuration
  var firebaseConfig = {
    apiKey: "AIzaSyC8Ug57XmuYuBinE43XYgfsw3GUS5enuE0",
    authDomain: "texhive-b1c82.firebaseapp.com",
    projectId: "texhive-b1c82",
    storageBucket: "texhive-b1c82.firebasestorage.app",
    messagingSenderId: "890451319179",
    appId: "1:890451319179:web:40ae1d6e0bccd3076ff78e",
    measurementId: "G-KY99JXZCFL"
  };
  firebase.initializeApp(firebaseConfig);

  // Add Firebase UI for authentication
  var uiConfig = {
    signInSuccessUrl: '/',
    signInOptions: [
      firebase.auth.GoogleAuthProvider.PROVIDER_ID
    ],
    tosUrl: '/terms-of-service',
    privacyPolicyUrl: '/privacy-policy'
  };
  var ui = new firebaseui.auth.AuthUI(firebase.auth());
  ui.start('#firebaseui-auth-container', uiConfig);

  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      user.getIdToken().then(function(token) {
        document.cookie = `token=${token}; path=/; secure; httponly`;
        document.getElementById('login-logout-btn').textContent = 'Logout';
      }).catch(function(error) {
        console.error('Error retrieving ID token', error);
      });
    } else {
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      document.getElementById('login-logout-btn').textContent = 'Login';
    }
  });

  function handleAuth() {
    var user = firebase.auth().currentUser;
    if (user) {
      firebase.auth().signOut().then(function() {
        document.getElementById('login-logout-btn').textContent = 'Login';
      }).catch(function(error) {
        console.error('Sign Out Error', error);
      });
    } else {
      ui.start('#firebaseui-auth-container', uiConfig);
    }
  }
