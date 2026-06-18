import React from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { RootStackParamList } from './src/navigation';
import { colors } from './src/theme';
import CollectionScreen from './src/screens/CollectionScreen';
import SearchScreen from './src/screens/SearchScreen';
import StatsScreen from './src/screens/StatsScreen';
import GameDetailScreen from './src/screens/GameDetailScreen';
import EditGameScreen from './src/screens/EditGameScreen';
import LogPlayScreen from './src/screens/LogPlayScreen';
import LoanScreen from './src/screens/LoanScreen';
import PlayerStatsScreen from './src/screens/PlayerStatsScreen';
import GameStatsScreen from './src/screens/GameStatsScreen';
import BackupScreen from './src/screens/BackupScreen';
import AboutScreen from './src/screens/AboutScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

function tabIcon(emoji: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Collection"
        component={CollectionScreen}
        options={{ tabBarIcon: tabIcon('🎲') }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ tabBarIcon: tabIcon('🔍') }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{ tabBarIcon: tabIcon('📊') }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="GameDetail" component={GameDetailScreen} options={{ title: '' }} />
          <Stack.Screen name="EditGame" component={EditGameScreen} options={{ title: 'Add Game' }} />
          <Stack.Screen name="LogPlay" component={LogPlayScreen} options={{ title: 'Log Play' }} />
          <Stack.Screen name="Loan" component={LoanScreen} options={{ title: 'Loan Out' }} />
          <Stack.Screen name="PlayerStats" component={PlayerStatsScreen} options={{ title: '' }} />
          <Stack.Screen name="GameStats" component={GameStatsScreen} options={{ title: '' }} />
          <Stack.Screen name="Backup" component={BackupScreen} options={{ title: 'Backup & Export' }} />
          <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About & Privacy' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
