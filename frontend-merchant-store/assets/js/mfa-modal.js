export class MfaModal {
  constructor(root) {
    this.root = root;
    this.state = { methods: [], transactionId: null };
    this.methodSelect = root.querySelector("select[data-role='method']");
    this.messageEl = root.querySelector("[data-role='message']");
    this.codeInput = root.querySelector("input[data-role='code']");
    this.requestButton = root.querySelector("button[data-role='request']");
    this.submitButton = root.querySelector("button[data-role='submit']");
    this.closeButtons = root.querySelectorAll("[data-role='close']");

    this.onRequestCode = null;
    this.onSubmit = null;

    this.requestButton.addEventListener("click", () => {
      if (!this.onRequestCode) return;
      const methodId = this.methodSelect.value;
      this.requestButton.disabled = true;
      this.requestButton.textContent = "Sending…";
      Promise.resolve(this.onRequestCode({ methodId, transactionId: this.state.transactionId }))
        .finally(() => {
          this.requestButton.disabled = false;
          this.requestButton.textContent = "Request Code";
        });
    });

    this.submitButton.addEventListener("click", () => {
      if (!this.onSubmit) return;
      const methodId = this.methodSelect.value;
      const code = this.codeInput.value.trim();
      if (code.length !== 6) {
        this.message("Enter the 6-digit code sent to you.", "error");
        return;
      }
      this.setLoading(true);
      Promise.resolve(
        this.onSubmit({ methodId, code, transactionId: this.state.transactionId })
      ).finally(() => this.setLoading(false));
    });

    this.closeButtons.forEach((button) =>
      button.addEventListener("click", () => this.close())
    );
  }

  open({ methods, transactionId, message }) {
    this.state = { methods, transactionId };
    this.populateMethods(methods);
    this.codeInput.value = "";
    this.message(message || "Two-factor verification required", "info");
    this.root.classList.remove("hidden");
  }

  close() {
    this.root.classList.add("hidden");
  }

  populateMethods(methods) {
    this.methodSelect.innerHTML = "";
    methods.forEach((method) => {
      const option = document.createElement("option");
      option.value = method.id;
      option.textContent = method.label;
      this.methodSelect.appendChild(option);
    });
  }

  message(text, variant = "info") {
    this.messageEl.textContent = text;
    this.messageEl.dataset.variant = variant;
  }

  setLoading(isLoading) {
    this.submitButton.disabled = isLoading;
    this.requestButton.disabled = isLoading;
    this.root.querySelector("[data-role='spinner']").classList.toggle("hidden", !isLoading);
  }
}
