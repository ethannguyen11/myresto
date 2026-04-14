import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiRequest, apiUpload } from '../../src/api/client';

// ── expo-av — native only ──────────────────────────────────────────────────
let Audio: any = null;
if (Platform.OS !== 'web') {
  Audio = require('expo-av').Audio;
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface GeneratedSheet {
  name: string;
  category: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  difficulty: string;
  ingredients: Ingredient[];
  steps: string[];
  presentation: string;
  tips: string;
}

interface TechSheet {
  id: number;
  name: string;
  category: string | null;
  servings: number;
  difficulty: string | null;
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>
  );
}

// ── Sheet preview ──────────────────────────────────────────────────────────

function SheetPreview({ sheet }: { sheet: GeneratedSheet }) {
  return (
    <View style={styles.previewCard}>
      {/* Name + category */}
      <Text style={styles.previewName}>{sheet.name}</Text>
      {sheet.category ? (
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{sheet.category}</Text>
        </View>
      ) : null}

      {/* Meta chips */}
      <View style={styles.chips}>
        {sheet.servings > 0 && (
          <View style={styles.chip}><Text style={styles.chipText}>{sheet.servings} couvert{sheet.servings > 1 ? 's' : ''}</Text></View>
        )}
        {sheet.prepTime > 0 && (
          <View style={styles.chip}><Text style={styles.chipText}>Prép. {sheet.prepTime} min</Text></View>
        )}
        {sheet.cookTime > 0 && (
          <View style={styles.chip}><Text style={styles.chipText}>Cuisson {sheet.cookTime} min</Text></View>
        )}
        {sheet.difficulty ? (
          <View style={[styles.chip, diffChipStyle(sheet.difficulty)]}>
            <Text style={[styles.chipText, diffTextStyle(sheet.difficulty)]}>{sheet.difficulty}</Text>
          </View>
        ) : null}
      </View>

      {/* Ingrédients */}
      {sheet.ingredients.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Ingrédients" />
          {sheet.ingredients.map((ing, i) => (
            <View key={i} style={styles.ingredientRow}>
              <Text style={styles.ingredientName}>{ing.name}</Text>
              <Text style={styles.ingredientQty}>{ing.quantity} {ing.unit}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Étapes */}
      {sheet.steps.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Progression" />
          {sheet.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Présentation */}
      {sheet.presentation ? (
        <View style={styles.section}>
          <SectionHeader title="Présentation" />
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>{sheet.presentation}</Text>
          </View>
        </View>
      ) : null}

      {/* Conseils */}
      {sheet.tips ? (
        <View style={styles.section}>
          <SectionHeader title="Conseils du chef" />
          <View style={[styles.noteBox, styles.tipsBox]}>
            <Text style={styles.noteText}>{sheet.tips}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function diffChipStyle(d: string) {
  if (d === 'Facile' || d === 'facile') return { backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' };
  if (d === 'Moyen' || d === 'moyen') return { backgroundColor: '#fffbeb', borderColor: '#fcd34d' };
  return { backgroundColor: '#fef2f2', borderColor: '#fca5a5' };
}
function diffTextStyle(d: string) {
  if (d === 'Facile' || d === 'facile') return { color: '#065f46' };
  if (d === 'Moyen' || d === 'moyen') return { color: '#92400e' };
  return { color: '#991b1b' };
}

// ── Page ───────────────────────────────────────────────────────────────────

type AppState =
  | 'home'
  | 'recording'
  | 'text-input'
  | 'transcribing'
  | 'generating'
  | 'preview'
  | 'saved';

export default function TechSheetScreen() {
  const [appState, setAppState] = useState<AppState>('home');
  const [sheets, setSheets] = useState<TechSheet[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(true);

  // recording
  const recordingRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // text input
  const [description, setDescription] = useState('');

  // generated
  const [generatedSheet, setGeneratedSheet] = useState<GeneratedSheet | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  // errors
  const [error, setError] = useState('');

  // ── Load list ──
  useEffect(() => {
    loadSheets();
  }, []);

  async function loadSheets() {
    try {
      const data = await apiRequest<TechSheet[]>('GET', '/tech-sheets');
      setSheets(data);
    } catch {
      // ignore
    } finally {
      setSheetsLoading(false);
    }
  }

  // ── Recording ──────────────────────────────────────────────────────────

  async function startRecording() {
    if (Platform.OS === 'web') {
      Alert.alert('Non disponible', 'L\'enregistrement vocal n\'est pas disponible sur le web.');
      return;
    }
    setError('');
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission refusée', 'Autorisez l\'accès au microphone dans les réglages.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordSeconds(0);
      setAudioUri(null);
      setAppState('recording');

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 299) {
            stopRecording();
            return 300;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      setError('Impossible de démarrer l\'enregistrement.');
    }
  }

  async function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setAudioUri(uri);
    } catch (e: any) {
      setError('Erreur à l\'arrêt de l\'enregistrement.');
    }
  }

  async function transcribeAndGenerate() {
    if (!audioUri) return;
    setError('');
    setAppState('transcribing');
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      const { transcription } = await apiUpload<{ transcription: string }>(
        '/tech-sheets/transcribe',
        formData,
      );
      setAppState('generating');
      const sheet = await apiRequest<GeneratedSheet>('POST', '/tech-sheets/generate', {
        description: transcription,
      });
      setGeneratedSheet(sheet);
      setAppState('preview');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erreur lors de la transcription.');
      setAppState('recording');
    }
  }

  // ── Text generate ──────────────────────────────────────────────────────

  async function generateFromText() {
    if (!description.trim()) return;
    setError('');
    setAppState('generating');
    try {
      const sheet = await apiRequest<GeneratedSheet>('POST', '/tech-sheets/generate', {
        description,
      });
      setGeneratedSheet(sheet);
      setAppState('preview');
    } catch {
      setError('Erreur lors de la génération.');
      setAppState('text-input');
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────

  async function saveSheet() {
    if (!generatedSheet) return;
    setError('');
    try {
      const saved = await apiRequest<TechSheet>('POST', '/tech-sheets/validate', generatedSheet);
      setSavedId(saved.id);
      setAppState('saved');
      await loadSheets();
    } catch {
      setError('Erreur lors de la sauvegarde.');
    }
  }

  function reset() {
    setAppState('home');
    setAudioUri(null);
    setRecordSeconds(0);
    setDescription('');
    setGeneratedSheet(null);
    setSavedId(null);
    setError('');
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HOME ── */}
        {appState === 'home' && (
          <>
            <Text style={styles.pageTitle}>Fiches techniques</Text>
            <Text style={styles.pageSubtitle}>Dictez ou écrivez votre recette</Text>

            {/* Action cards */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionCard, styles.actionCardVoice]} onPress={startRecording}>
                <Text style={styles.actionEmoji}>🎤</Text>
                <Text style={styles.actionTitle}>Dicter</Text>
                <Text style={styles.actionSub}>Enregistrement vocal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionCard, styles.actionCardText]} onPress={() => setAppState('text-input')}>
                <Text style={styles.actionEmoji}>✍️</Text>
                <Text style={styles.actionTitle}>Saisir</Text>
                <Text style={styles.actionSub}>Description écrite</Text>
              </TouchableOpacity>
            </View>

            {/* Existing sheets */}
            <View style={styles.listSection}>
              <Text style={styles.listTitle}>Mes fiches ({sheets.length})</Text>
              {sheetsLoading ? (
                <ActivityIndicator color="#16a34a" style={{ marginTop: 16 }} />
              ) : sheets.length === 0 ? (
                <Text style={styles.emptyText}>Aucune fiche pour l'instant</Text>
              ) : (
                sheets.map((s) => (
                  <View key={s.id} style={styles.sheetRow}>
                    <View style={styles.sheetInfo}>
                      <Text style={styles.sheetName}>{s.name}</Text>
                      <Text style={styles.sheetMeta}>
                        {s.category ? `${s.category} · ` : ''}{s.servings} couvert{s.servings > 1 ? 's' : ''}
                        {s.difficulty ? ` · ${s.difficulty}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.sheetDate}>
                      {new Date(s.createdAt).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* ── RECORDING ── */}
        {(appState === 'recording' || appState === 'transcribing') && (
          <View style={styles.centered}>
            <Text style={styles.pageTitle}>Enregistrement</Text>

            {/* Pulsing mic button */}
            <TouchableOpacity
              style={[styles.micButton, isRecording && styles.micButtonActive]}
              onPress={isRecording ? stopRecording : startRecording}
              activeOpacity={0.8}
            >
              <Text style={styles.micEmoji}>🎤</Text>
            </TouchableOpacity>

            <Text style={styles.timerText}>{formatTime(recordSeconds)}</Text>
            <Text style={styles.timerSub}>Max 5:00</Text>

            {isRecording ? (
              <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                <Text style={styles.stopBtnText}>⏹ Arrêter</Text>
              </TouchableOpacity>
            ) : audioUri ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={transcribeAndGenerate}
                disabled={appState === 'transcribing'}
              >
                {appState === 'transcribing' ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.primaryBtnText}> Transcription…</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>📤 Transcrire et générer</Text>
                )}
              </TouchableOpacity>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.linkBtn} onPress={reset}>
              <Text style={styles.linkBtnText}>← Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── TEXT INPUT ── */}
        {appState === 'text-input' && (
          <View>
            <Text style={styles.pageTitle}>Décrire la recette</Text>
            <Text style={styles.pageSubtitle}>Décrivez librement votre recette</Text>
            <TextInput
              style={styles.textarea}
              multiline
              numberOfLines={10}
              value={description}
              onChangeText={setDescription}
              placeholder={
                'Ex : Pavé de saumon poêlé pour 4 personnes avec beurre blanc à l\'estragon. Saisir le saumon 3 min de chaque côté dans une poêle chaude avec du beurre. Préparer le beurre blanc séparément avec échalotes, vin blanc et crème...'
              }
              placeholderTextColor="#a8a29e"
              textAlignVertical="top"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryBtn, !description.trim() && styles.btnDisabled]}
              onPress={generateFromText}
              disabled={!description.trim()}
            >
              <Text style={styles.primaryBtnText}>✨ Générer la fiche</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkBtn} onPress={reset}>
              <Text style={styles.linkBtnText}>← Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── GENERATING ── */}
        {appState === 'generating' && (
          <View style={styles.centered}>
            <ActivityIndicator color="#16a34a" size="large" />
            <Text style={styles.loadingText}>L'IA génère votre fiche…</Text>
            <Text style={styles.loadingSub}>Quelques secondes</Text>
          </View>
        )}

        {/* ── PREVIEW ── */}
        {appState === 'preview' && generatedSheet && (
          <View>
            <Text style={styles.pageTitle}>Prévisualisation</Text>
            <Text style={styles.pageSubtitle}>Vérifiez avant de sauvegarder</Text>

            <SheetPreview sheet={generatedSheet} />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.primaryBtn} onPress={saveSheet}>
              <Text style={styles.primaryBtnText}>✅ Sauvegarder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={reset}>
              <Text style={styles.secondaryBtnText}>🔄 Recommencer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SAVED ── */}
        {appState === 'saved' && (
          <View style={styles.centered}>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successTitle}>Fiche sauvegardée !</Text>
            <Text style={styles.successSub}>Votre fiche technique a été créée.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={reset}>
              <Text style={styles.primaryBtnText}>← Retour à la liste</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const GREEN = '#16a34a';
const GREEN_LIGHT = '#dcfce7';
const STONE_50 = '#fafaf9';
const STONE_100 = '#f5f5f4';
const STONE_200 = '#e7e5e4';
const STONE_400 = '#a8a29e';
const STONE_600 = '#57534e';
const STONE_800 = '#292524';
const RED = '#dc2626';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: STONE_50 },
  scroll: { padding: 20, paddingBottom: 40 },

  pageTitle: { fontSize: 24, fontWeight: '700', color: STONE_800, marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: STONE_400, marginBottom: 20 },

  // Action cards
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  actionCard: {
    flex: 1, borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1,
  },
  actionCardVoice: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  actionCardText: { backgroundColor: '#f8fafc', borderColor: STONE_200 },
  actionEmoji: { fontSize: 32, marginBottom: 8 },
  actionTitle: { fontSize: 16, fontWeight: '600', color: STONE_800, marginBottom: 2 },
  actionSub: { fontSize: 12, color: STONE_400, textAlign: 'center' },

  // List
  listSection: { marginTop: 4 },
  listTitle: { fontSize: 14, fontWeight: '600', color: STONE_600, marginBottom: 12 },
  emptyText: { color: STONE_400, fontSize: 14, textAlign: 'center', marginTop: 8 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: STONE_200,
  },
  sheetInfo: { flex: 1 },
  sheetName: { fontSize: 14, fontWeight: '600', color: STONE_800 },
  sheetMeta: { fontSize: 12, color: STONE_400, marginTop: 2 },
  sheetDate: { fontSize: 11, color: STONE_400 },

  // Recording
  centered: { alignItems: 'center', paddingVertical: 20 },
  micButton: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: STONE_200, alignItems: 'center', justifyContent: 'center',
    marginVertical: 24,
  },
  micButtonActive: { backgroundColor: '#fecaca' },
  micEmoji: { fontSize: 42 },
  timerText: { fontSize: 36, fontWeight: '700', color: STONE_800, letterSpacing: 2 },
  timerSub: { fontSize: 12, color: STONE_400, marginTop: 4, marginBottom: 20 },

  stopBtn: {
    backgroundColor: RED, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14,
    marginVertical: 8,
  },
  stopBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  loadingText: { fontSize: 18, fontWeight: '600', color: STONE_800, marginTop: 20 },
  loadingSub: { fontSize: 13, color: STONE_400, marginTop: 6 },

  // Buttons
  primaryBtn: {
    backgroundColor: GREEN, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryBtn: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: STONE_200,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '500', color: STONE_600 },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkBtnText: { color: STONE_400, fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  btnRow: { flexDirection: 'row', alignItems: 'center' },

  // Textarea
  textarea: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: STONE_200,
    padding: 16, fontSize: 14, color: STONE_800, minHeight: 180, marginBottom: 12,
  },

  // Error
  errorText: { color: RED, fontSize: 13, textAlign: 'center', marginTop: 8 },

  // Success
  successEmoji: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '700', color: STONE_800, marginBottom: 8 },
  successSub: { fontSize: 14, color: STONE_400, marginBottom: 24 },

  // Preview card
  previewCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: STONE_200,
    padding: 20, marginBottom: 12,
  },
  previewName: { fontSize: 20, fontWeight: '700', color: STONE_800, marginBottom: 8 },
  categoryBadge: {
    backgroundColor: STONE_100, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 10,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: '500', color: STONE_600 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    backgroundColor: STONE_100, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: STONE_200,
  },
  chipText: { fontSize: 12, color: STONE_600 },

  // Section
  section: { marginTop: 14 },
  sectionHeader: {
    fontSize: 10, fontWeight: '700', color: STONE_400, letterSpacing: 1,
    borderBottomWidth: 1, borderBottomColor: STONE_100, paddingBottom: 4, marginBottom: 8,
  },

  // Ingredients
  ingredientRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: STONE_100,
  },
  ingredientName: { fontSize: 13, color: STONE_800, fontWeight: '500', flex: 1 },
  ingredientQty: { fontSize: 13, color: STONE_400 },

  // Steps
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: GREEN,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 13, color: STONE_800, lineHeight: 20 },

  // Notes
  noteBox: {
    backgroundColor: STONE_50, borderLeftWidth: 3, borderLeftColor: GREEN,
    borderRadius: 8, padding: 12,
  },
  tipsBox: { borderLeftColor: '#f59e0b', backgroundColor: '#fffbeb' },
  noteText: { fontSize: 13, color: STONE_600, lineHeight: 20 },
});
