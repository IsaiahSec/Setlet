
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, setToken } from "../services/api";
import "./Auth.css";

function Login({ onLogin }) {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");

    // runs when the user submits the form
    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        // check empty fields
        if (email === "" || pass === "") {
            setError("Please fill in all fields.");
            return;
        }

        // check email
        if (!email.includes("@")) {
            setError("Please enter a valid email.");
            return;
        }

        try {
            // send login information to backend
            const data = await login(email, pass);

            // save token and update login status
            setToken(data.token);
            onLogin?.();

            // go to mysets after successful login
            navigate("/mysets", { replace: true });
        } catch (err) {
            console.log(err);
            setError(err.message);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-aside" aria-label="Setlet study tools">
                <Link className="auth-brand" to="/login">
                    <span className="app-brand-mark" aria-hidden="true">S</span>
                    Setlet
                </Link>
                <div className="auth-aside-copy">
                    <span className="auth-kicker">Make learning stick</span>
                    <h2>Small sessions.<br />Big progress.</h2>
                    <p>Your next idea is one card away.</p>
                </div>
                <div className="auth-note" aria-hidden="true">
                    <span>01</span><i /><span>02</span><i /><span>03</span>
                </div>
            </section>
            <section className="auth-content">
                <div className="auth-card">
                    <span className="auth-kicker">Welcome back</span>
                    <h1>Login</h1>
                    <p className="auth-intro">Pick up right where you left off.</p>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label htmlFor="login-email">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                            />
                        </div>

                        <div className="auth-field">
                            <label htmlFor="login-password">Password</label>
                            <input
                                id="login-password"
                                type="password"
                                value={pass}
                                onChange={(e) => setPass(e.target.value)}
                                autoComplete="current-password"
                            />
                        </div>

                        {error !== "" && <p className="auth-error" role="alert">{error}</p>}

                        <button className="auth-submit" type="submit">Login</button>
                    </form>

                    <p className="auth-switch">
                        Don't have an account? <Link to="/signup">Sign Up</Link>
                    </p>
                </div>
            </section>
        </main>
    );
}

export default Login;
