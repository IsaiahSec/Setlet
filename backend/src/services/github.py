import json
import os
from urllib import error, request


class GitHubFeedbackError(Exception):
    pass


def create_feedback_issue(title, body, labels):
    token = os.environ.get("GITHUB_FEEDBACK_TOKEN")
    repo = os.environ.get("GITHUB_REPO")
    if not token or not repo:
        raise GitHubFeedbackError("GitHub feedback client is not configured")

    payload = {"title": title, "body": body, "labels": labels}
    req = request.Request(
        f"https://api.github.com/repos/{repo}/issues",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=10) as response:
            if response.status < 200 or response.status >= 300:
                raise GitHubFeedbackError("GitHub feedback request failed")
    except (error.HTTPError, error.URLError, TimeoutError) as exc:
        raise GitHubFeedbackError("GitHub feedback request failed") from exc
