import { Tabs } from "expo-router";
import { Crosshair, User } from "lucide-react-native";
import React from "react";
import { Platform } from "react-native";
import Colors from "@/constants/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.accent.primary,
        tabBarInactiveTintColor: Colors.dark.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.dark.surface,
          borderTopColor: Colors.dark.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? {} : {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 12,
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600" as const,
          letterSpacing: 0.3,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="hunt"
        options={{
          title: "Hunt",
          tabBarIcon: ({ color, size }) => <Crosshair color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
