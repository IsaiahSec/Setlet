// base url for the backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// this function sends requests to the backend
async function request(endpoint, options) {
    // get the token from local storage
    const token = localStorage.getItem("token");

    // set up the headers
    let headers = {
        "Content-Type": "application/json",
    };

    // if there are extra headers, add them
    if (options && options.headers) {
        Object.assign(headers, options.headers);
    }

    // if the user is logged in, add the token
    if (token) {
        headers["Authorization"] = "Bearer " + token;
    }

    const response = await fetch(API_BASE_URL + endpoint, {
        method: options && options.method ? options.method : "GET",
        headers: headers,
        body: options ? options.body : undefined,
    });

    let data = {};

    // try to turn the response into json
    try {
        data = await response.json();
    } catch {
    // response may not contain JSON
    }

    // if something went wrong, throw an error
    if (!response.ok) {
        throw new Error(data.error || data.message || "Something went wrong");
    }

    return data;
}

// sign up a new user
export function signup(email, password) {
    return request("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: email, password: password }),
    });
}

// log in an existing user
export function login(email, password) {
    return request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email, password: password }),
    });
}

// save token
export function setToken(token) {
    localStorage.setItem("token", token);
}

// get token
export function getToken() {
    return localStorage.getItem("token");
}

// remove token (for logout)
export function clearToken() {
    localStorage.removeItem("token");
}