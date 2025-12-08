import { Tabs } from "expo-router";
import { Home, User } from "lucide-react-native";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1E40AF",
        tabBarInactiveTintColor: "#666",
        tabBarStyle: {
          backgroundColor: "#1A1A1A",
          borderTopColor: "#333",
          borderTopWidth: 1,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="hunt"
        options={{
          title: "Hunt",
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}