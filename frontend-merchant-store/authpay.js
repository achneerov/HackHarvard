import { waitForAuth, webhookClient, verifyMFA } from './js/mockBackend.js';

const enableAuthPay = () => {
  const fallbackProcess = window.process_payment;

  const orchestrateAuthPay = async (payload, ui) => {
    ui.showStatus('info', 'Routing through AuthPay orchestration...');
    ui.toggleProcessing(true);

    await waitForAuth();
    const response = await webhookClient.processTransaction(payload);

    if (response.status === 'SUCCESS') {
      ui.showStatus('success', 'Payment authorized. Preparing confirmation...');
      return response;
    }

    if (response.status === 'FAILURE') {
      ui.showStatus('failure', response.reason || 'Transaction cancelled, please contact merchant.');
      ui.toggleProcessing(false);
      return response;
    }

    if (response.status !== 'AUTH_REQUIRED') {
      ui.toggleProcessing(false);
      return response;
    }

    ui.showStatus('info', 'Additional authentication required.');

    return await new Promise((resolve) => {
      const launchMfa = (methods) => {
        ui.showMfa({
          methods,
          onRequestCode: async (method) => {
            ui.setMfaStatus('info', `Requesting code via ${method.toUpperCase()}...`);
            const result = await webhookClient.requestMfaCode({ ccHash: payload.ccHash, method });
            ui.setMfaStatus('success', result.message || 'Verification code dispatched.');
            return result;
          },
          onSubmitCode: async (code) => {
            ui.setMfaStatus('info', 'Validating code...');
            const verification = await verifyMFA({ ccHash: payload.ccHash, code });
            if (verification.status === 'SUCCESS') {
              ui.setMfaStatus('success', 'Verification accepted. Completing transaction...');
              ui.hideMfa();
              resolve(verification);
            } else if (verification.status === 'FAILURE') {
              ui.setMfaStatus('failure', verification.reason || 'Verification failed. Transaction cancelled.');
              ui.hideMfa();
              ui.toggleProcessing(false);
              resolve(verification);
            } else if (verification.status === 'AUTH_REQUIRED') {
              ui.setMfaStatus('info', verification.message || 'Select an alternate authentication method.');
              launchMfa(verification.methods);
            }
          },
          onCancel: () => {
            const failure = {
              status: 'FAILURE',
              reason: 'Transaction cancelled, please contact merchant.',
            };
            ui.hideMfa();
            ui.toggleProcessing(false);
            resolve(failure);
          },
        });
      };

      launchMfa(response.methods);
    });
  };

  window.process_payment = orchestrateAuthPay;
  window.AuthPayIntegration = {
    processPayment: orchestrateAuthPay,
    fallbackProcess,
  };
};

if (window.PaymentUI) {
  enableAuthPay();
} else {
  window.addEventListener('DOMContentLoaded', enableAuthPay, { once: true });
}
