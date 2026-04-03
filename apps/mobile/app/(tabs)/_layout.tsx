import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

const GREEN = '#16a34a';
const GRAY = '#78716c';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: GREEN,
        tabBarInactiveTintColor: GRAY,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e7e5e4',
          borderTopWidth: 1,
          paddingTop: 4,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          height: Platform.OS === 'ios' ? 80 : 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="📷" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="advisor"
        options={{
          title: 'Conseiller',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="✨" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

// Simple emoji icon for tabs
function TabIcon({ emoji, size }: { emoji: string; color: string; size: number }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: size - 4 }}>{emoji}</Text>;
}
