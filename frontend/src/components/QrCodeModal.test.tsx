import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";

const h = vi.hoisted(() => ({copy: vi.fn(async () => true), notifySuccess: vi.fn()}));

vi.mock("qrcode", () => ({
  default: {toDataURL: vi.fn(async () => "data:image/png;base64,QR")},
}));
vi.mock("../hooks/useI18n", () => ({useI18n: () => ({t: (_k: string, f: string) => f})}));
vi.mock("../utils/clipboard", () => ({copyToClipboard: h.copy}));
vi.mock("../utils/notify", () => ({notify: {success: h.notifySuccess, error: vi.fn()}}));

import QrCodeModal from "./QrCodeModal";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("QrCodeModal", () => {
  it("renders nothing when closed", () => {
    render(<QrCodeModal open={false} onClose={() => undefined} url="https://myapp.example" />);
    expect(screen.queryByTestId("qr-modal")).toBeNull();
  });

  it("renders the QR image + url when open", async () => {
    render(<QrCodeModal open onClose={() => undefined} url="https://myapp.example" />);
    expect(screen.getByTestId("qr-modal-url").textContent).toBe("https://myapp.example");
    await waitFor(() =>
      expect(screen.getByTestId("qr-modal-image").getAttribute("src")).toContain("data:image/png"),
    );
  });

  it("copies the link", async () => {
    render(<QrCodeModal open onClose={() => undefined} url="https://myapp.example" />);
    fireEvent.click(screen.getByTestId("qr-modal-copy"));
    await waitFor(() => expect(h.copy).toHaveBeenCalledWith("https://myapp.example"));
    expect(h.notifySuccess).toHaveBeenCalled();
  });

  it("closes on the close button", () => {
    const onClose = vi.fn();
    render(<QrCodeModal open onClose={onClose} url="https://myapp.example" />);
    fireEvent.click(screen.getByTestId("qr-modal-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
