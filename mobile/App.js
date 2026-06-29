import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";

const SITE_URL = "https://fisiltigazetesi.app";

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const goBack = useCallback(() => {
    if (canGoBack) {
      webViewRef.current?.goBack();
    }
  }, [canGoBack]);

  const reload = useCallback(() => {
    setHasError(false);
    webViewRef.current?.reload();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={!canGoBack}
          onPress={goBack}
          style={[styles.headerButton, !canGoBack && styles.disabledButton]}
        >
          <Text style={styles.headerButtonText}>Geri</Text>
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.title}>Fısıltı</Text>
          <Text style={styles.subtitle}>Gazetesi</Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={reload}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>Yenile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.webShell}>
        <WebView
          ref={webViewRef}
          source={{ uri: SITE_URL }}
          domStorageEnabled
          javaScriptEnabled
          pullToRefreshEnabled
          setSupportMultipleWindows={false}
          sharedCookiesEnabled
          startInLoadingState
          thirdPartyCookiesEnabled
          onError={() => setHasError(true)}
          onLoadEnd={() => setIsLoading(false)}
          onLoadStart={() => {
            setHasError(false);
            setIsLoading(true);
          }}
          onNavigationStateChange={(event) => {
            setCanGoBack(event.canGoBack);
          }}
          renderError={() => (
            <View style={styles.centerState}>
              <Text style={styles.stateTitle}>Bağlantı kurulamadı</Text>
              <Text style={styles.stateText}>
                İnternetini kontrol edip tekrar deneyelim.
              </Text>
              <TouchableOpacity onPress={reload} style={styles.retryButton}>
                <Text style={styles.retryText}>Yeniden Dene</Text>
              </TouchableOpacity>
            </View>
          )}
          renderLoading={() => (
            <View style={styles.centerState}>
              <ActivityIndicator color="#1d1b17" />
              <Text style={styles.stateText}>Gazete hazırlanıyor...</Text>
            </View>
          )}
          style={styles.webview}
        />

        {isLoading && !hasError ? (
          <View pointerEvents="none" style={styles.loadingLine} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4ecd8",
    paddingTop: Platform.OS === "android" ? 28 : 0,
  },
  header: {
    alignItems: "center",
    backgroundColor: "#f4ecd8",
    borderBottomColor: "#1d1b17",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
  },
  headerButton: {
    alignItems: "center",
    borderColor: "#1d1b17",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 68,
    paddingHorizontal: 12,
  },
  disabledButton: {
    opacity: 0.35,
  },
  headerButtonText: {
    color: "#1d1b17",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  titleWrap: {
    alignItems: "center",
    flex: 1,
  },
  title: {
    color: "#1d1b17",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0,
  },
  subtitle: {
    color: "#7b1713",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  webShell: {
    flex: 1,
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    backgroundColor: "#f4ecd8",
  },
  centerState: {
    alignItems: "center",
    backgroundColor: "#f4ecd8",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  stateTitle: {
    color: "#1d1b17",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  stateText: {
    color: "#5f584e",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#1d1b17",
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: {
    color: "#f4ecd8",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  loadingLine: {
    backgroundColor: "#7b1713",
    height: 2,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
