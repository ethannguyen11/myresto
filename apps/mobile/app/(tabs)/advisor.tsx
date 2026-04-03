import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { api } from '../../src/api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Simple markdown renderer for RN ───────────────────────────────────────

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((line, i) => {
        if (line.trim() === '') return <View key={i} style={{ height: 6 }} />;

        // Detect line type
        const isH1 = line.startsWith('# ');
        const isH2 = line.startsWith('## ');
        const isH3 = line.startsWith('### ');
        const isHr = /^---+$/.test(line.trim());
        const isBullet = /^[-•]\s/.test(line.trim());
        const isNumbered = /^\d+[\.\)]\s/.test(line.trim());

        if (isHr) {
          return <View key={i} style={mdStyles.hr} />;
        }

        const raw = isH1
          ? line.slice(2)
          : isH2
            ? line.slice(3)
            : isH3
              ? line.slice(4)
              : line;

        // Render bold within a line
        const parts = raw.split(/(\*\*[^*]+\*\*)/g);
        const inlineContent = parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <Text key={j} style={mdStyles.bold}>
              {part.slice(2, -2)}
            </Text>
          ) : (
            <Text key={j}>{part}</Text>
          ),
        );

        if (isH1) {
          return (
            <Text key={i} style={[mdStyles.base, mdStyles.h1]}>
              {inlineContent}
            </Text>
          );
        }
        if (isH2) {
          return (
            <Text key={i} style={[mdStyles.base, mdStyles.h2]}>
              {inlineContent}
            </Text>
          );
        }
        if (isH3) {
          return (
            <Text key={i} style={[mdStyles.base, mdStyles.h3]}>
              {inlineContent}
            </Text>
          );
        }
        if (isBullet || isNumbered) {
          return (
            <Text key={i} style={[mdStyles.base, mdStyles.listItem]}>
              {inlineContent}
            </Text>
          );
        }
        // Emoji heading
        if (/^\p{Emoji}/u.test(line.trim())) {
          return (
            <Text key={i} style={[mdStyles.base, mdStyles.emojiHeading]}>
              {inlineContent}
            </Text>
          );
        }
        return (
          <Text key={i} style={mdStyles.base}>
            {inlineContent}
          </Text>
        );
      })}
    </View>
  );
}

const mdStyles = StyleSheet.create({
  base: { fontSize: 14, color: '#44403c', lineHeight: 22, marginBottom: 2 },
  bold: { fontWeight: '700', color: '#1c1917' },
  h1: { fontSize: 18, fontWeight: '700', color: '#1c1917', marginTop: 12, marginBottom: 4 },
  h2: { fontSize: 16, fontWeight: '700', color: '#1c1917', marginTop: 10, marginBottom: 2 },
  h3: { fontSize: 15, fontWeight: '600', color: '#292524', marginTop: 8, marginBottom: 2 },
  emojiHeading: { fontSize: 14, fontWeight: '600', color: '#1c1917', marginTop: 8 },
  listItem: { paddingLeft: 12, color: '#57534e' },
  hr: { height: 1, backgroundColor: '#e7e5e4', marginVertical: 10 },
});

// ── Screen ─────────────────────────────────────────────────────────────────

export default function AdvisorScreen() {
  const [report, setReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, chatLoading]);

  async function handleGenerateReport() {
    setReportLoading(true);
    setReportError('');
    try {
      const res = await api.post<{ report: string; generatedAt: string }>('/advisor/report');
      setReport(res.data.report);
    } catch (err: any) {
      console.error('[Advisor] report', err);
      setReportError(err.response?.data?.message ?? 'Impossible de générer le rapport.');
    } finally {
      setReportLoading(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setChatLoading(true);
    setChatError('');

    try {
      const res = await api.post<{ reply: string }>('/advisor/chat', {
        message: text,
        history: messages,
      });
      setMessages((m) => [...m, { role: 'assistant', content: res.data.reply }]);
    } catch (err: any) {
      console.error('[Advisor] chat', err);
      setChatError(err.response?.data?.message ?? 'Erreur IA. Réessayez.');
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text style={styles.title}>Conseiller IA</Text>
          <Text style={styles.subtitle}>Analyse et recommandations pour votre restaurant</Text>

          {/* ── Report section ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Rapport de rentabilité</Text>
              <TouchableOpacity
                style={[styles.generateButton, reportLoading && styles.disabled]}
                onPress={handleGenerateReport}
                disabled={reportLoading}
                activeOpacity={0.85}
              >
                {reportLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.generateButtonText}>
                    {report ? '↺ Regénérer' : '✨ Générer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {reportError ? (
              <Text style={styles.errorText}>{reportError}</Text>
            ) : report ? (
              <View style={styles.reportContent}>
                <MarkdownText text={report} />
              </View>
            ) : !reportLoading ? (
              <View style={styles.emptyReport}>
                <Text style={styles.emptyEmoji}>📊</Text>
                <Text style={styles.emptyText}>
                  Générez un rapport pour obtenir des recommandations personnalisées
                </Text>
              </View>
            ) : (
              <View style={styles.emptyReport}>
                <ActivityIndicator color="#16a34a" />
                <Text style={styles.loadingText}>L'IA analyse vos données…</Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>Chat avec le conseiller</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Chat messages ── */}
          {messages.length === 0 && !chatLoading ? (
            <View style={styles.emptyChat}>
              <Text style={styles.emptyEmoji}>🤖</Text>
              <Text style={styles.emptyText}>
                Posez une question sur votre rentabilité, vos recettes ou vos prix.
              </Text>
            </View>
          ) : (
            <View style={styles.messagesContainer}>
              {messages.map((msg, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  {msg.role === 'assistant' ? (
                    <MarkdownText text={msg.content} />
                  ) : (
                    <Text style={styles.userBubbleText}>{msg.content}</Text>
                  )}
                </View>
              ))}
              {chatLoading && (
                <View style={[styles.bubble, styles.aiBubble]}>
                  <View style={styles.typingDots}>
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={styles.dot} />
                    ))}
                  </View>
                </View>
              )}
              {chatError ? (
                <Text style={styles.errorText}>{chatError}</Text>
              ) : null}
            </View>
          )}

          {/* Spacer so input doesn't cover last message */}
          <View style={{ height: 80 }} />
        </ScrollView>

        {/* ── Chat input (sticky bottom) ── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Posez une question…"
            placeholderTextColor="#a8a29e"
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!chatLoading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || chatLoading) && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || chatLoading}
            activeOpacity={0.85}
          >
            {chatLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendIcon}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GREEN = '#16a34a';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f4' },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 16 },

  // Header
  title: { fontSize: 22, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#78716c', marginBottom: 20 },

  // Section
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1c1917' },
  generateButton: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  generateButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  reportContent: { paddingTop: 4 },
  emptyReport: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyText: {
    fontSize: 13,
    color: '#78716c',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  loadingText: { fontSize: 13, color: '#78716c', marginTop: 8 },
  errorText: { fontSize: 13, color: '#dc2626', padding: 8 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e7e5e4' },
  dividerLabel: {
    marginHorizontal: 10,
    fontSize: 12,
    fontWeight: '500',
    color: '#a8a29e',
  },

  // Chat
  emptyChat: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  messagesContainer: { gap: 10 },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: GREEN,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderBottomLeftRadius: 4,
  },
  userBubbleText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  typingDots: { flexDirection: 'row', gap: 4, padding: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#a8a29e' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e7e5e4',
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1c1917',
    backgroundColor: '#fafaf9',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
});
