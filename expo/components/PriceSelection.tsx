import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Ticket } from 'lucide-react-native';
import { TICKET_TIERS } from '@/constants/payment';
import { TicketTier } from '@/types/payment';

interface PriceSelectionProps {
  selectedTier: TicketTier | null;
  onSelectTier: (tier: TicketTier) => void;
  onPurchase: (tier: TicketTier) => void;
  isProcessing: boolean;
  disabled?: boolean;
}

export default function PriceSelection({
  selectedTier,
  onSelectTier,
  onPurchase,
  isProcessing,
  disabled = false,
}: PriceSelectionProps) {
  const ticket = TICKET_TIERS[0]; // Single ticket
  const isSelected = selectedTier?.id === ticket.id;

  const handleTicketPress = () => {
    if (disabled || isProcessing) return;
    onSelectTier(ticket);
  };

  const handlePurchasePress = () => {
    if (disabled || isProcessing) return;
    onPurchase(ticket);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Join the Hunt</Text>
        <Text style={styles.subtitle}>
          Get your ticket and start the adventure
        </Text>
      </View>

      <View style={styles.ticketContainer}>
        <TouchableOpacity
          style={[
            styles.ticketCard,
            isSelected && styles.ticketCardSelected,
            (disabled || isProcessing) && styles.ticketCardDisabled,
          ]}
          onPress={handleTicketPress}
          disabled={disabled || isProcessing}
        >
          <LinearGradient
            colors={['#00D4FF', '#0099CC']}
            style={styles.ticketGradient}
          >
            <View style={styles.ticketHeader}>
              <View style={styles.ticketIconContainer}>
                <Ticket color="#FFF" size={32} />
              </View>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketName}>
                  {ticket.name}
                </Text>
                <Text style={styles.ticketDescription}>
                  {ticket.description}
                </Text>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.price}>
                  {ticket.isFree ? 'FREE' : `€${ticket.price}`}
                </Text>
              </View>
            </View>

            <View style={styles.featuresContainer}>
              {ticket.features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Check color="#FFF" size={16} />
                  <Text style={styles.featureText}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.purchaseButton,
                isSelected && styles.purchaseButtonSelected,
                (disabled || isProcessing) && styles.purchaseButtonDisabled,
              ]}
              onPress={handlePurchasePress}
              disabled={disabled || isProcessing}
            >
              <Text style={styles.purchaseButtonText}>
                {isProcessing && selectedTier?.id === ticket.id
                  ? 'PROCESSING...'
                  : ticket.isFree ? 'CLAIM TICKET' : 'BUY TICKET'
                }
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
  ticketContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  ticketCard: {
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  ticketCardSelected: {
    transform: [{ scale: 1.02 }],
    elevation: 12,
    shadowOpacity: 0.5,
  },
  ticketCardDisabled: {
    opacity: 0.6,
  },
  ticketGradient: {
    padding: 32,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  ticketIconContainer: {
    marginRight: 20,
    marginTop: 4,
  },
  ticketInfo: {
    flex: 1,
  },
  ticketName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 8,
  },
  ticketDescription: {
    fontSize: 18,
    color: '#FFF',
    opacity: 0.9,
    lineHeight: 24,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFF',
  },
  featuresContainer: {
    marginBottom: 32,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 18,
    marginLeft: 16,
    flex: 1,
    lineHeight: 24,
    color: '#FFF',
  },
  purchaseButton: {
    backgroundColor: '#FFF',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  purchaseButtonSelected: {
    backgroundColor: '#F0F0F0',
  },
  purchaseButtonDisabled: {
    backgroundColor: '#666',
  },
  purchaseButtonText: {
    color: '#00D4FF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
});