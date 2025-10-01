import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, CreditCard, CheckCircle, ExternalLink } from 'lucide-react-native';
import * as Linking from 'expo-linking';


interface PaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Stripe Buy Button HTML
const STRIPE_BUY_BUTTON_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Purchase Ticket</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background-color: #0A0A0A;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #FFF;
    }
    .price {
      font-size: 32px;
      font-weight: 900;
      color: #00D4FF;
      margin-bottom: 12px;
    }
    .description {
      font-size: 16px;
      color: #888;
      margin-bottom: 32px;
      line-height: 1.4;
    }
    stripe-buy-button {
      width: 100%;
    }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">Hunt Ticket</h1>
    <div class="price">€3.99</div>
    <p class="description">Get access to the ultimate treasure hunt experience</p>
    
    <script async src="https://js.stripe.com/v3/buy-button.js"></script>
    <stripe-buy-button
      buy-button-id="buy_btn_1SDPZ9ATZcBhONrD5OLBgEBU"
      publishable-key="pk_live_51SDNfLATZcBhONrDvT4RuU80vZVQDya0arefGMMI7hjQk0iwMezXuU8yQjn6JkUzKrAfM3dyITDt2h1jQ5vgJo4600JSj9j8Ht"
    ></stripe-buy-button>
    
    <div class="footer">
      Secure payment powered by Stripe
    </div>
  </div>
  
  <script>
    // Listen for successful payment
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'stripe_checkout_success') {
        // Notify React Native about successful payment
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'payment_success'
        }));
      }
    });
    
    // Alternative: Listen for URL changes that indicate success
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        if (lastUrl.includes('success') || lastUrl.includes('payment_intent')) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'payment_success'
          }));
        }
      }
    }, 1000);
  </script>
</body>
</html>
`;

export default function PaymentSheet({
  visible,
  onClose,
  onSuccess,
}: PaymentSheetProps) {
  const insets = useSafeAreaInsets();
  const [showWebView, setShowWebView] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);


  const handlePurchase = () => {
    if (Platform.OS === 'web') {
      // On web, create a popup with the Stripe buy button
      const popup = window.open('', '_blank', 'width=500,height=600,scrollbars=yes');
      if (popup) {
        popup.document.write(STRIPE_BUY_BUTTON_HTML);
        popup.document.close();
      }
      onClose();
    } else {
      // On mobile, show WebView
      setShowWebView(true);
    }
  };

  const handleOpenInBrowser = async () => {
    try {
      // Create a data URL with the HTML content
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(STRIPE_BUY_BUTTON_HTML)}`;
      await Linking.openURL(dataUrl);
      onClose();
    } catch {
      Alert.alert('Error', 'Could not open payment link');
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'payment_success') {
        setShowWebView(false);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.log('WebView message parsing error:', error);
    }
  };

  const handleWebViewNavigationStateChange = (navState: any) => {
    const { url } = navState;
    
    // Check for Stripe success indicators
    if (url.includes('success') || url.includes('payment_intent') || url.includes('checkout-success')) {
      setShowWebView(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onSuccess();
        onClose();
      }, 2000);
    } else if (url.includes('canceled') || url.includes('cancel')) {
      setShowWebView(false);
    }
  };

  const handleClose = () => {
    if (showWebView) {
      setShowWebView(false);
      return;
    }
    onClose();
  };

  if (showSuccess) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <LinearGradient
          colors={['#0A0A0A', '#1A1A1A']}
          style={[styles.container, { paddingTop: insets.top }]}
        >
          <View style={styles.successContainer}>
            <CheckCircle color="#00D4FF" size={80} />
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successMessage}>
              Your ticket has been purchased successfully.
              Get ready for an amazing hunt experience!
            </Text>
          </View>
        </LinearGradient>
      </Modal>
    );
  }

  if (showWebView && Platform.OS !== 'web') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        <View style={[styles.webViewContainer, { paddingTop: insets.top }]}>
          <View style={styles.webViewHeader}>
            <Text style={styles.webViewTitle}>Secure Payment</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X color="#FFF" size={24} />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: STRIPE_BUY_BUTTON_HTML }}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            onMessage={handleWebViewMessage}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            mixedContentMode="compatibility"
            allowsInlineMediaPlayback={true}
          />
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={['#0A0A0A', '#1A1A1A']}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <CreditCard color="#00D4FF" size={24} />
            <Text style={styles.headerTitle}>Purchase Ticket</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}

          >
            <X color="#FFF" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.ticketCard}>
            <Text style={styles.ticketTitle}>Hunt Ticket</Text>
            <Text style={styles.ticketPrice}>€3.99</Text>
            <Text style={styles.ticketDescription}>
              Get access to the ultimate treasure hunt experience
            </Text>
            
            <TouchableOpacity
              style={styles.purchaseButton}
              onPress={handlePurchase}
            >
              <CreditCard color="#FFF" size={20} />
              <Text style={styles.purchaseButtonText}>Purchase Ticket</Text>
            </TouchableOpacity>
            
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={styles.browserButton}
                onPress={handleOpenInBrowser}
              >
                <ExternalLink color="#00D4FF" size={16} />
                <Text style={styles.browserButtonText}>Open in Browser</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Secure payment powered by Stripe
          </Text>
          <Text style={styles.footerSubtext}>
            Your payment information is encrypted and secure
          </Text>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 12,
  },
  closeButton: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1A1A',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#FF6B6B',
    marginLeft: 12,
    lineHeight: 20,
  },
  errorCloseButton: {
    padding: 4,
    marginLeft: 8,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 300,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00D4FF',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  webView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  ticketCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  ticketTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  ticketPrice: {
    fontSize: 32,
    fontWeight: '900',
    color: '#00D4FF',
    marginBottom: 12,
  },
  ticketDescription: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D4FF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 8,
  },
  browserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  browserButtonText: {
    fontSize: 14,
    color: '#00D4FF',
    marginLeft: 6,
  },
});