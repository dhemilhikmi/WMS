// Load Midtrans Snap JS library
export function loadMidtransSnap(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if snap is already loaded
    if ((window as any).snap) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://app.midtrans.com/snap/snap.js';
    script.type = 'text/javascript';
    script.async = true;
    script.dataset.clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || 'SB-Mid-client-test-key';

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Failed to load Midtrans Snap'));
    };

    document.head.appendChild(script);
  });
}

// Open Midtrans Snap payment popup
export async function openMidtransSnap(snapToken: string): Promise<void> {
  await loadMidtransSnap();

  return new Promise((resolve, reject) => {
    try {
      (window as any).snap.pay(snapToken, {
        onSuccess: (result: any) => {
          console.log('Payment success:', result);
          resolve();
        },
        onPending: (result: any) => {
          console.log('Payment pending:', result);
        },
        onError: (result: any) => {
          console.log('Payment error:', result);
          reject(new Error('Payment failed'));
        },
        onClose: () => {
          console.log('Payment popup closed');
          reject(new Error('Payment cancelled'));
        },
      });
    } catch (err) {
      reject(err);
    }
  });
}
