import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useRootNavigationState } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const navState = useRootNavigationState();

  useEffect(() => {
    // Wait until the navigation container is ready before redirecting
    if (!navState?.key) return;

    AsyncStorage.getItem('access_token').then((token) => {
      if (token) {
        router.replace('/(tabs)/scanner');
      } else {
        router.replace('/login');
      }
    });
  }, [navState?.key]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#16a34a" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
