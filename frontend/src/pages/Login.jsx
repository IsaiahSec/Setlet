
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, setToken } from "../services/api";

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
        <div>
            <h1>Login</h1>

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="login-email">Email</label>
                    <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="login-password">Password</label>
                    <input
                        id="login-password"
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                    />
                </div>

                {error !== "" && <p>{error}</p>}

                <button type="submit">Login</button>
            </form>

            <p>
                Don't have an account? <Link to="/signup">Sign Up</Link>
            </p>
        </div>
    );
}

export default Login;
