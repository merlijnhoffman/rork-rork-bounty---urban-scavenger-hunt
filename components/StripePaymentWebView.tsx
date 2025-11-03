import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

interface StripePaymentWebViewProps {
  clientSecret: string;
  publishableKey: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

export default function StripePaymentWebView({
  clientSecret,
  publishableKey,
  onSuccess,
  onError,
}: StripePaymentWebViewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const webViewRef = useRef<WebView>(null);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script src="https://js.stripe.com/v3/"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0A0A0A;
            color: #FFF;
            padding: 20px;
            min-height: 100vh;
          }
          #payment-form {
            max-width: 500px;
            margin: 0 auto;
          }
          #payment-element {
            margin-bottom: 24px;
            padding: 16px;
            background: #1A1A1A;
            border-radius: 12px;
            border: 1px solid #333;
          }
          #submit {
            width: 100%;
            padding: 16px;
            background: #00D4FF;
            color: #FFF;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
          }
          #submit:hover:not(:disabled) {
            background: #00B8E6;
            transform: translateY(-1px);
          }
          #submit:disabled {
            background: #666;
            cursor: not-allowed;
          }
          #error-message {
            color: #FF6B6B;
            margin-top: 16px;
            padding: 12px;
            background: #2A1A1A;
            border-radius: 8px;
            border-left: 4px solid #FF6B6B;
            display: none;
          }
          #error-message.visible {
            display: block;
          }
          .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #FFF;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 0.6s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <form id="payment-form">
          <div id="payment-element"></div>
          <button id="submit">
            <span id="button-text">Pay Now</span>
          </button>
          <div id="error-message"></div>
        </form>

        <script>
          function log(message) {
            console.log(message);
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'log',
              message: message,
            }));
          }
          
          try {
            log('Initializing Stripe...');
            
            if (!window.Stripe) {
              throw new Error('Stripe.js failed to load');
            }
            
            const stripe = Stripe('${publishableKey}');
            log('Stripe initialized');
            
            const clientSecret = '${clientSecret}';
            log('Client secret length: ' + clientSecret.length);
            
            if (!clientSecret || clientSecret === 'undefined') {
              throw new Error('Invalid client secret');
            }
            
            const options = {
              clientSecret: clientSecret,
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: '#00D4FF',
                  colorBackground: '#1A1A1A',
                  colorText: '#FFF',
                  colorDanger: '#FF6B6B',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  borderRadius: '12px',
                },
              },
            };

            log('Creating elements...');
            const elements = stripe.elements(options);
            const paymentElement = elements.create('payment');
            
            log('Mounting payment element...');
            paymentElement.mount('#payment-element');
            
            paymentElement.on('ready', () => {
              log('Payment element ready');
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'ready',
              }));
            });
            
            paymentElement.on('loaderror', (event) => {
              log('Payment element load error: ' + JSON.stringify(event));
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'error',
                message: 'Failed to load payment form: ' + (event.error ? event.error.message : 'Unknown error'),
              }));
            });

          const form = document.getElementById('payment-form');
          const submitButton = document.getElementById('submit');
          const buttonText = document.getElementById('button-text');
          const errorMessage = document.getElementById('error-message');

          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            submitButton.disabled = true;
            buttonText.innerHTML = '<span class="spinner"></span> Processing...';
            errorMessage.classList.remove('visible');

            try {
              const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                  return_url: 'https://rork.app/payment-success',
                },
                redirect: 'if_required',
              });

              if (error) {
                errorMessage.textContent = error.message;
                errorMessage.classList.add('visible');
                submitButton.disabled = false;
                buttonText.textContent = 'Pay Now';
                
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'error',
                  message: error.message,
                }));
              } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                window.ReactNativeWebView?.postMessage(JSON.stringify({
                  type: 'success',
                  paymentIntentId: paymentIntent.id,
                }));
              } else {
                errorMessage.textContent = 'Payment processing failed. Please try again.';
                errorMessage.classList.add('visible');
                submitButton.disabled = false;
                buttonText.textContent = 'Pay Now';
              }
            } catch (err) {
              errorMessage.textContent = 'An unexpected error occurred.';
              errorMessage.classList.add('visible');
              submitButton.disabled = false;
              buttonText.textContent = 'Pay Now';
              
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'error',
                message: 'An unexpected error occurred',
              }));
            }
          });

          } catch (error) {
            log('Stripe initialization error: ' + error.message);
            const errorDiv = document.getElementById('error-message');
            if (errorDiv) {
              errorDiv.textContent = error.message || 'Failed to initialize payment form';
              errorDiv.classList.add('visible');
            }
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'error',
              message: error.message || 'Failed to initialize payment form',
            }));
          }
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      console.log('WebView message:', data);

      switch (data.type) {
        case 'ready':
          console.log('Payment form is ready');
          setLoading(false);
          break;
        case 'success':
          console.log('Payment successful, ID:', data.paymentIntentId);
          onSuccess(data.paymentIntentId);
          break;
        case 'error':
          console.log('Payment error:', data.message);
          setLoading(false);
          onError(data.message);
          break;
        case 'log':
          console.log('WebView log:', data.message);
          break;
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4FF" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          onError('Failed to load payment form');
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView HTTP error:', nativeEvent);
        }}
        onLoadEnd={() => {
          console.log('WebView loaded');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    zIndex: 1,
  },
});
