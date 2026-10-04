import { useState } from "react";
import { login, setToken } from "../services/api";

function Login() {
    // input states
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");

    // runs when login button is clicked
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
            // send to backend
            const data = await login(email, pass);

            // save token
            setToken(data.token);

            // go to mysets page
            window.location.href = "/mysets";
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
                    <label>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div>
                    <label>Password</label>
                    <input
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                    />
                </div>

                {/* error message */}
                {error !== "" && <p>{error}</p>}

                <button type="submit">Login</button>
            </form>
        </div>
    );
}

export default Login;