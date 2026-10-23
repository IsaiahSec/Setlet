// base url for the backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// this function sends requests to the backend
export async function request(endpoint, options) {
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
    const isAuthRequest =
    endpoint === "/auth/login" || endpoint === "/auth/signup";

    if (token && !isAuthRequest) {
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
        if (response.status === 401 && !isAuthRequest && token) {
            clearToken();
            window.location.replace("/login");
       }

    const error = new Error(data.error || data.message || "Something went wrong");
    error.status = response.status;
    throw error;
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

 // get the current user's study sets
export function listSets() {
  return request("/sets");
}

// create a new study set
export function createSet(title, description = "") {
  return request("/sets", {
    method: "POST",
    body: JSON.stringify({
      title,
      description,
    }),
  });
}

// delete a study set
export function deleteSet(id) {
  return request(`/sets/${id}`, {
    method: "DELETE",
  });
}
// get a study set and its cards
export function getSet(id) {
    return request(`/sets/${id}`);
}

// update a study set's title or description
export function updateSet(id, data) {
    return request(`/sets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}

// add a new card to a study set
export function createCard(setId, front, back) {
    return request(`/sets/${setId}/cards`, {
        method: "POST",
        body: JSON.stringify({ front, back }),
    });
}

// update an existing card
export function updateCard(setId, cardId, data) {
    return request(`/sets/${setId}/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}

// delete a card from a study set
export function deleteCard(setId, cardId) {
    return request(`/sets/${setId}/cards/${cardId}`, {
        method: "DELETE",
    });
}
// Get the flashcards for a study session
export function getStudySession(setId) {
  return request(`/sets/${setId}/study`);
}

// Save a flashcard review rating (1 = Again, 4 = Easy)
export function reviewCard(cardId, rating) {
  return request(`/cards/${cardId}/review`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}

// Get public study sets with search and pagination
export function listPublicSets(query = "", page = 1, pageSize = 10) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    page_size: String(pageSize),
  });

  return request(`/sets/public?${params.toString()}`);
}
