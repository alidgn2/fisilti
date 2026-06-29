import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

const API_BASE = "https://sea-lion-app-jcnrp.ondigitalocean.app/api";

const CATEGORIES = [
  { id: "kahvehane", label: "Kahvehane" },
  { id: "berber", label: "Berber" },
  { id: "taksi", label: "Taksi" },
  { id: "dolmus", label: "Dolmuş" },
  { id: "market", label: "Market" },
  { id: "caybahcesi", label: "Çay Bahçesi" },
  { id: "lokanta", label: "Lokanta" },
  { id: "kuafor", label: "Kuaför" },
  { id: "park", label: "Park" },
  { id: "diger", label: "Diğer" },
];

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item?.msg).filter(Boolean).join(", ")
      : detail || "İşlem tamamlanamadı";
    throw new Error(message);
  }

  return data;
}

export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [mode, setMode] = useState("login");
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [whispers, setWhispers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("kahvehane");

  const authed = Boolean(token && user);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const data = await request("/whispers?limit=30&sort=new", { token });
      setWhispers(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert("Akış alınamadı", error.message);
    } finally {
      setFeedLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authed) {
      loadFeed();
    }
  }, [authed, loadFeed]);

  const selectedCategory = useMemo(
    () => CATEGORIES.find((item) => item.id === category) || CATEGORIES[0],
    [category],
  );

  async function submitAuth() {
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login"
          ? { email: form.email.trim(), password: form.password }
          : {
              name: form.name.trim(),
              email: form.email.trim(),
              password: form.password,
            };
      const data = await request(endpoint, { method: "POST", body: payload });
      setToken(data.session_token);
      setUser(data.user);
      setScreen("home");
    } catch (error) {
      Alert.alert("Olmadı kanka", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitWhisper() {
    const content = draft.trim();
    if (content.length < 10) {
      Alert.alert("Biraz daha yaz", "Fısıltı en az 10 karakter olmalı.");
      return;
    }

    setLoading(true);
    try {
      await request("/whispers", {
        method: "POST",
        token,
        body: { content, category },
      });
      setDraft("");
      await loadFeed();
    } catch (error) {
      Alert.alert("Fısıltı bırakılmadı", error.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    setWhispers([]);
    setScreen("welcome");
  }

  if (!authed && screen === "welcome") {
    return (
      <AppFrame>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Mahalle Ajansı</Text>
          <Text style={styles.brand}>Fısıltı Gazetesi</Text>
          <Text style={styles.copy}>
            Kahvehaneden, berberden, taksiden... halkın kulağına çalınanlar.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              setMode("register");
              setScreen("auth");
            }}
          >
            <Text style={styles.primaryText}>Muhabir Ol</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setMode("login");
              setScreen("auth");
            }}
          >
            <Text style={styles.secondaryText}>Giriş Yap</Text>
          </Pressable>
        </View>
      </AppFrame>
    );
  }

  if (!authed) {
    return (
      <AppFrame>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.authWrap}
        >
          <Text style={styles.kicker}>Editör Kapısı</Text>
          <Text style={styles.pageTitle}>
            {mode === "login" ? "Giriş Yap" : "Muhabir Ol"}
          </Text>

          {mode === "register" ? (
            <TextInput
              autoCapitalize="words"
              onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
              placeholder="Adın"
              placeholderTextColor="#8a8173"
              style={styles.input}
              value={form.name}
            />
          ) : null}
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(email) => setForm((prev) => ({ ...prev, email }))}
            placeholder="Email"
            placeholderTextColor="#8a8173"
            style={styles.input}
            value={form.email}
          />
          <TextInput
            onChangeText={(password) =>
              setForm((prev) => ({ ...prev, password }))
            }
            placeholder="Şifre"
            placeholderTextColor="#8a8173"
            secureTextEntry
            style={styles.input}
            value={form.password}
          />

          <Pressable
            disabled={loading}
            onPress={submitAuth}
            style={[styles.primaryButton, loading && styles.disabled]}
          >
            <Text style={styles.primaryText}>
              {loading ? "Bekle..." : mode === "login" ? "Giriş Yap" : "Kaydol"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setMode(mode === "login" ? "register" : "login")}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>
              {mode === "login"
                ? "Hesabın yok mu? Muhabir ol"
                : "Hesabın var mı? Giriş yap"}
            </Text>
          </Pressable>
        </KeyboardAvoidingView>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Son Dakika</Text>
          <Text style={styles.pageTitle}>Günün Fısıltıları</Text>
        </View>
        <Pressable onPress={logout} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Çıkış</Text>
        </Pressable>
      </View>

      <View style={styles.composer}>
        <Text style={styles.composerTitle}>Yeni fısıltı</Text>
        <TextInput
          multiline
          onChangeText={setDraft}
          placeholder="Mahallede ne duydun?"
          placeholderTextColor="#8a8173"
          style={styles.textarea}
          value={draft}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
        >
          {CATEGORIES.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setCategory(item.id)}
              style={[
                styles.categoryChip,
                item.id === category && styles.categoryChipActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  item.id === category && styles.categoryTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          disabled={loading}
          onPress={submitWhisper}
          style={[styles.primaryButton, loading && styles.disabled]}
        >
          <Text style={styles.primaryText}>
            {loading ? "Bırakılıyor..." : `${selectedCategory.label} Fısıltısı Bırak`}
          </Text>
        </Pressable>
      </View>

      {feedLoading ? (
        <ActivityIndicator color="#1d1b17" style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.feed}
          data={whispers}
          keyExtractor={(item) => item.whisper_id}
          onRefresh={loadFeed}
          refreshing={feedLoading}
          renderItem={({ item }) => <WhisperCard item={item} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Henüz fısıltı yok.</Text>
          }
        />
      )}
    </AppFrame>
  );
}

function AppFrame({ children }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {children}
    </SafeAreaView>
  );
}

function WhisperCard({ item }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardMeta}>
        {item.category?.toUpperCase()} · {item.author_name || "Anonim"}
      </Text>
      <Text style={styles.cardText}>{item.content}</Text>
      <Text style={styles.cardFooter}>
        ↑ {item.upvotes || 0}   ↓ {item.downvotes || 0}   Yorum {item.comment_count || 0}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f4ecd8",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 28 : 0,
  },
  hero: {
    flex: 1,
    justifyContent: "center",
  },
  kicker: {
    color: "#9b1c17",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  brand: {
    color: "#1d1b17",
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 48,
  },
  copy: {
    color: "#4b463e",
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 28,
    marginTop: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1d1b17",
    borderColor: "#1d1b17",
    borderWidth: 1,
    minHeight: 50,
    justifyContent: "center",
    marginTop: 12,
    paddingHorizontal: 18,
  },
  primaryText: {
    color: "#f4ecd8",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#1d1b17",
    borderWidth: 1,
    minHeight: 50,
    justifyContent: "center",
    marginTop: 12,
    paddingHorizontal: 18,
  },
  secondaryText: {
    color: "#1d1b17",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  authWrap: {
    flex: 1,
    justifyContent: "center",
  },
  pageTitle: {
    color: "#1d1b17",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 38,
  },
  input: {
    borderColor: "#1d1b17",
    borderWidth: 1,
    color: "#1d1b17",
    fontSize: 16,
    marginTop: 14,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  linkButton: {
    alignItems: "center",
    marginTop: 18,
  },
  linkText: {
    color: "#1d1b17",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  disabled: {
    opacity: 0.55,
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#1d1b17",
    borderBottomWidth: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingTop: 12,
  },
  smallButton: {
    borderColor: "#1d1b17",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  smallButtonText: {
    color: "#1d1b17",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  composer: {
    borderBottomColor: "#1d1b17",
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  composerTitle: {
    color: "#1d1b17",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  textarea: {
    borderColor: "#1d1b17",
    borderWidth: 1,
    color: "#1d1b17",
    fontSize: 16,
    minHeight: 92,
    padding: 12,
    textAlignVertical: "top",
  },
  categoryRow: {
    marginTop: 10,
  },
  categoryChip: {
    borderColor: "#1d1b17",
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  categoryChipActive: {
    backgroundColor: "#1d1b17",
  },
  categoryText: {
    color: "#1d1b17",
    fontSize: 12,
    fontWeight: "800",
  },
  categoryTextActive: {
    color: "#f4ecd8",
  },
  loader: {
    marginTop: 24,
  },
  feed: {
    paddingBottom: 28,
    paddingTop: 12,
  },
  card: {
    borderBottomColor: "#1d1b17",
    borderBottomWidth: 1,
    paddingVertical: 16,
  },
  cardMeta: {
    color: "#9b1c17",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 8,
  },
  cardText: {
    color: "#1d1b17",
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 27,
  },
  cardFooter: {
    color: "#5f584e",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
  },
  emptyText: {
    color: "#5f584e",
    fontSize: 15,
    marginTop: 30,
    textAlign: "center",
  },
});
