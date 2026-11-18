import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Feedback from "./Feedback";
import { sendFeedback } from "../services/api";

vi.mock("../services/api", () => ({
  sendFeedback: vi.fn(),
}));

function renderFeedback() {
  return render(
    <MemoryRouter>
      <Feedback />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.resetAllMocks();
  sendFeedback.mockResolvedValue({ message: "Thanks for your feedback" });
});

describe("Feedback page", () => {
  test("disables Send when the message is empty or whitespace", () => {
    renderFeedback();

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Your message"), {
      target: { value: "   " },
    });
    expect(sendButton.disabled).toBe(true);
    expect(screen.getByText("3 / 2000 characters")).toBeTruthy();
  });

  test("shows the character count and caps input at 2000 characters", () => {
    renderFeedback();

    const textarea = screen.getByLabelText("Your message");
    expect(textarea.maxLength).toBe(2000);

    fireEvent.change(textarea, { target: { value: "Hello" } });

    expect(screen.getByText("5 / 2000 characters")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" }).disabled).toBe(false);
  });

  test("replaces the form with confirmation after success", async () => {
    renderFeedback();

    fireEvent.change(screen.getByLabelText("Your message"), {
      target: { value: "A useful suggestion" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation.textContent).toContain("Thank you for your feedback");
    expect(sendFeedback).toHaveBeenCalledWith("A useful suggestion");
    expect(screen.queryByLabelText("Your message")).toBeNull();
  });

  test.each([
    [429, "You can send feedback once per hour"],
    [502, "Could not send feedback right now"],
  ])(
    "shows the API's %i error and preserves the message",
    async (status, message) => {
      const error = new Error(message);
      error.status = status;
      sendFeedback.mockRejectedValue(error);

      renderFeedback();

      const textarea = screen.getByLabelText("Your message");
      fireEvent.change(textarea, {
        target: { value: "Please improve this" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send" }));

      const errorMessage = await screen.findByRole("alert");
      expect(errorMessage.textContent).toContain(message);
      expect(textarea.value).toBe("Please improve this");
      expect(screen.getByRole("button", { name: "Send" }).disabled).toBe(
        false
      );
    }
  );

  test("disables Send while the request is in flight", async () => {
    let resolveSend;
    sendFeedback.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      })
    );

    renderFeedback();
    fireEvent.change(screen.getByLabelText("Your message"), {
      target: { value: "Feedback" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByRole("button", { name: "Sending..." }).disabled).toBe(
      true
    );
    expect(sendFeedback).toHaveBeenCalledTimes(1);

    resolveSend({ message: "Thanks for your feedback" });
    const confirmation = await screen.findByRole("status");
    expect(confirmation.textContent).toContain("Thank you for your feedback");
  });
});
