# Project Architecture & Skeleton

## Project Overview

This project is a web application designed to allow users to create, manage, share, and study sets of learning material.

The application is planned around a separated frontend, backend, and data layer. This document represents the initial architecture and project skeleton.

---

## 1. Frontend

### Technology

The frontend is built using React with Vite.

### Structure

The initial frontend structure is organized into three primary areas:

- `components/` - reusable user interface components
- `pages/` - page-level components representing the main application views
- `services/` - code responsible for communication with backend services

### Initial Pages

The frontend skeleton currently includes placeholders for:

- `Login.jsx` - user login
- `Signup.jsx` - user registration
- `MySets.jsx` - user's study sets
- `PublicSets.jsx` - publicly available study sets
- `SetEditor.jsx` - creation and editing of study sets and cards
- `StudyReview.jsx` - studying and reviewing a set

These files establish the planned frontend organization and do not represent completed features.

### Service Layer

`services/api.js` is reserved for communication between the frontend and the backend API. This keeps API communication separate from page and UI components.

---

## 2. Backend

### Technology

### Structure

### API

---

## 3. Database

### Technology

### Initial Data Model

---

## 4. Authentication and Authorization

---

## 5. Frontend-Backend Integration

The frontend will communicate with the backend through an API.

Specific endpoints, request and response structures, and other integration details will be added as the backend structure is developed.

---

## 6. Current Project Skeleton

```text
project/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── MySets.jsx
│   │   │   ├── PublicSets.jsx
│   │   │   ├── SetEditor.jsx
│   │   │   └── StudyReview.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│
└── architecture.md
