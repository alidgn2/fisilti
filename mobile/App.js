import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";

const SITE_URL = "https://fisiltigazetesi.app";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <WebView
        source={{ uri: SITE_URL }}
        startInLoadingState
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4ecd8",
  },
  webview: {
    flex: 1,
    backgroundColor: "#f4ecd8",
  },
});
