import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Star, Zap } from 'lucide-react-native';
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
  const handleTierPress = (tier: TicketTier) => {
    if (disabled || isProcessing) return;
    onSelectTier(tier);
  };

  const handlePurchasePress = (tier: TicketTier) => {
    if (disabled || isProcessing) return;
    onPurchase(tier);
  };

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'basic':
        return <Zap color="#00D4FF" size={24} />;
      case 'premium':
        return <Star color="#FFD700" size={24} />;
      case 'vip':
        return <Star color="#FF6B6B" size={24} />;
      default:
        return <Zap color="#00D4FF" size={24} />;
    }
  };

  const getTierGradient = (tierId: string): [string, string] => {
    switch (tierId) {
      case 'basic':
        return ['#1A1A1A', '#2A2A2A'];
      case 'premium':
        return ['#FFD700', '#FFA500'];
      case 'vip':
        return ['#FF6B6B', '#FF4757'];
      default:
        return ['#1A1A1A', '#2A2A2A'];
    }
  };

  const getTierTextColor = (tierId: string) => {
    return tierId === 'basic' ? '#FFF' : '#000';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Hunt Experience</Text>
        <Text style={styles.subtitle}>
          Select the perfect tier for your adventure
        </Text>
      </View>

      <ScrollView 
        style={styles.tiersContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.tiersContent}
      >
        {TICKET_TIERS.map((tier) => {
          const isSelected = selectedTier?.id === tier.id;
          const textColor = getTierTextColor(tier.id);
          
          return (
            <TouchableOpacity
              key={tier.id}
              style={[
                styles.tierCard,
                isSelected && styles.tierCardSelected,
                (disabled || isProcessing) && styles.tierCardDisabled,
              ]}
              onPress={() => handleTierPress(tier)}
              disabled={disabled || isProcessing}
            >
              <LinearGradient
                colors={getTierGradient(tier.id)}
                style={styles.tierGradient}
              >
                {tier.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>MOST POPULAR</Text>
                  </View>
                )}

                <View style={styles.tierHeader}>
                  <View style={styles.tierIconContainer}>
                    {getTierIcon(tier.id)}
                  </View>
                  <View style={styles.tierInfo}>
                    <Text style={[styles.tierName, { color: textColor }]}>
                      {tier.name}
                    </Text>
                    <Text style={[styles.tierDescription, { color: textColor, opacity: 0.8 }]}>
                      {tier.description}
                    </Text>
                  </View>
                  <View style={styles.priceContainer}>
                    <Text style={[styles.price, { color: textColor }]}>
                      €{tier.price}
                    </Text>
                    <Text style={[styles.currency, { color: textColor, opacity: 0.7 }]}>
                      {tier.currency}
                    </Text>
                  </View>
                </View>

                <View style={styles.featuresContainer}>
                  {tier.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <Check color={textColor} size={16} />
                      <Text style={[styles.featureText, { color: textColor }]}>
                        {feature}
                      </Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.purchaseButton,
                    tier.id === 'basic' && styles.purchaseButtonBasic,
                    isSelected && styles.purchaseButtonSelected,
                    (disabled || isProcessing) && styles.purchaseButtonDisabled,
                  ]}
                  onPress={() => handlePurchasePress(tier)}
                  disabled={disabled || isProcessing}
                >
                  <Text style={[
                    styles.purchaseButtonText,
                    tier.id !== 'basic' && styles.purchaseButtonTextDark,
                  ]}>
                    {isProcessing && selectedTier?.id === tier.id
                      ? 'PROCESSING...'
                      : `SELECT ${tier.name.toUpperCase()}`
                    }
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  tiersContainer: {
    flex: 1,
  },
  tiersContent: {
    padding: 20,
    gap: 20,
  },
  tierCard: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tierCardSelected: {
    transform: [{ scale: 1.02 }],
    elevation: 8,
    shadowOpacity: 0.5,
  },
  tierCardDisabled: {
    opacity: 0.6,
  },
  tierGradient: {
    padding: 24,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF6B6B',
    paddingVertical: 8,
    alignItems: 'center',
    zIndex: 1,
  },
  popularText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 16,
  },
  tierIconContainer: {
    marginRight: 16,
    marginTop: 4,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  tierDescription: {
    fontSize: 16,
    lineHeight: 22,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 32,
    fontWeight: '900',
  },
  currency: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: -4,
  },
  featuresContainer: {
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
    lineHeight: 22,
  },
  purchaseButton: {
    backgroundColor: '#00D4FF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  purchaseButtonBasic: {
    backgroundColor: '#00D4FF',
  },
  purchaseButtonSelected: {
    backgroundColor: '#0099CC',
  },
  purchaseButtonDisabled: {
    backgroundColor: '#333',
  },
  purchaseButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  purchaseButtonTextDark: {
    color: '#000',
  },
});