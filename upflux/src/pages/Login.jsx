import { useState } from "react";
import { auth, db } from "../services/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const navigate = useNavigate();

  // Check if username already exists
  const checkUsernameExists = async (username) => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  const handleSignup = async () => {
    try {
      setSignupError("");

      const rawUsername = window.prompt("Create a username (at least 3 characters):", "");
      if (!rawUsername) {
        setSignupError("Username is required to create an account.");
        return;
      }

      const trimmedUsername = rawUsername.trim();

      if (trimmedUsername.length < 3) {
        setSignupError("Username must be at least 3 characters long.");
        return;
      }

      const usernameExists = await checkUsernameExists(trimmedUsername);
      if (usernameExists) {
        setSignupError("Username already exists. Please try a different name.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        username: trimmedUsername,
        email: email,
        createdAt: new Date()
      });

      alert("Signup successful!");
      navigate("/dashboard");
    } catch (error) {
      setSignupError(error.message);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSignupError("");
      alert("Login successful!");
      navigate("/dashboard");
    } catch (error) {
      setSignupError(error.message);
    }
  };

  const buttonStyle = {
    backgroundColor: '#4a4a4a',
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginRight: '10px',
    fontSize: '14px',
    fontWeight: 'bold'
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', textAlign: 'center' }}>
      <div style={{ backgroundColor: '#f0f0f0', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' }}>
        <Link to="/" style={{ ...buttonStyle, display: 'block', marginBottom: '20px', textAlign: 'center' }}>← Back to Home</Link>
        <h1>Login</h1>

        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '5px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />

        {signupError && (
          <div style={{ 
            color: '#dc2626', 
            backgroundColor: '#fee2e2', 
            padding: '10px', 
            borderRadius: '5px', 
            marginBottom: '15px', 
            fontSize: '14px',
            border: '1px solid #fecaca'
          }}>
            {signupError}
          </div>
        )}

        <div>
          <button onClick={handleLogin} style={buttonStyle}>Login</button>
          <button onClick={handleSignup} style={buttonStyle}>Signup</button>
        </div>
      </div>
    </div>
  );
}

export default Login;