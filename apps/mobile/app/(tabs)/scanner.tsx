import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { apiRequest, apiUpload } from '../../src/api/client';

// expo-image-picker and expo-camera are native-only.
// The if-block (not ternary) lets babel-preset-expo replace Platform.OS with
// the literal 'web' at build time, allowing Metro to dead-code-eliminate this.
let ImagePicker: any = null;
let Camera: any = null;
if (Platform.OS !== 'web') {
  ImagePicker = require('expo-image-picker');
  Camera = require('expo-camera');
}

// ── Types ──────────────────────────────────────────────────────────────────

type UploadStatus = 'idle' | 'uploading' | 'polling' | 'done' | 'validating' | 'imported' | 'error';

interface Ingredient {
  id: number;
  name: string;
  unit: string;
}

interface InvoiceItem {
  id: number;
  rawName: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  ingredientId: number | null;
  matchScore: number | null;
  matchMethod: string | null;
}

interface Invoice {
  id: number;
  status: 'pending' | 'analyzing' | 'reviewed' | 'validated' | 'error';
  supplierName: string | null;
  totalAmount: number | null;
  items: InvoiceItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n === null || n === undefined) return '—';
  return Number(n).toFixed(2).replace('.', ',') + ' €';
}

// ── Web fallback ───────────────────────────────────────────────────────────

function WebFallback() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.webFallback}>
        <Text style={styles.webEmoji}>📸</Text>
        <Text style={styles.webTitle}>Scanner disponible sur l'app mobile</Text>
        <Text style={styles.webText}>
          Téléchargez l'app Chef IA sur votre iPhone ou Android{'\n'}
          pour scanner vos factures directement depuis l'appareil photo.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ScannerScreen() {
  if (Platform.OS === 'web') {
    return <WebFallback />;
  }

  return <ScannerNative />;
}

const FILE_SIZE_MIN = 50 * 1024; // 50 KB

function ScannerNative() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState(0);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [permError, setPermError] = useState('');
  const [importResult, setImportResult] = useState<{ updated: number; created: number } | null>(null);
  const [validateError, setValidateError] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Charge la liste des ingrédients au montage pour les labels de suggestion
  useEffect(() => {
    apiRequest<Ingredient[]>('GET', '/ingredients')
      .then(setIngredients)
      .catch(() => {});
  }, []);

  // ── Permissions ──────────────────────────────────────────────────────────

  async function requestCameraPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setPermError('Autorisez l\'accès à la caméra dans les paramètres pour scanner des factures.');
      return false;
    }
    return true;
  }

  async function requestGalleryPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPermError('Autorisez l\'accès à la galerie dans les paramètres.');
      return false;
    }
    return true;
  }

  // ── Image selection ───────────────────────────────────────────────────────

  async function handleCamera() {
    setPermError('');
    const ok = await requestCameraPermission();
    if (!ok) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      resetAndSetImage(result.assets[0].uri, result.assets[0].fileSize ?? 0);
    }
  }

  async function handleGallery() {
    setPermError('');
    const ok = await requestGalleryPermission();
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      resetAndSetImage(result.assets[0].uri, result.assets[0].fileSize ?? 0);
    }
  }

  function resetAndSetImage(uri: string, fileSize = 0) {
    stopPolling();
    setImageUri(uri);
    setFileSizeBytes(fileSize);
    setStatus('idle');
    setProgress(0);
    setInvoice(null);
    setErrorMsg('');
  }

  // ── Upload & analysis ──────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!imageUri) return;

    setStatus('uploading');
    setProgress(0);
    setErrorMsg('');
    setInvoice(null);

    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'invoice.jpg',
    } as any);

    try {
      const uploaded = await apiUpload<Invoice>('/invoices/upload', formData);

      const invoiceId = uploaded.id;
      setStatus('polling');
      setProgress(100);

      // Poll every 3s until analysis is done
      pollRef.current = setInterval(async () => {
        try {
          const poll = await apiRequest<Invoice>('GET', `/invoices/${invoiceId}`);
          setInvoice(poll);

          if (poll.status === 'reviewed' || poll.status === 'validated') {
            stopPolling();
            setStatus('done');
          } else if (poll.status === 'error') {
            stopPolling();
            setStatus('error');
            setErrorMsg('L\'analyse IA a échoué. Vérifiez la qualité de l\'image.');
          }
        } catch {
          // keep polling silently
        }
      }, 3000);
    } catch (err: any) {
      console.error('[Scanner] upload', err);
      setStatus('error');
      setErrorMsg(err.response?.data?.message ?? 'Échec de l\'envoi. Vérifiez votre connexion.');
    }
  }

  async function handleValidate() {
    if (!invoice) return;
    setStatus('validating');
    setValidateError('');
    try {
      // Mémorise les correspondances validées par suggestion ou mémoire
      const toMemorize = invoice.items.filter(
        (item) =>
          item.ingredientId &&
          (item.matchMethod === 'suggestion' || item.matchMethod === 'auto'),
      );
      await Promise.allSettled(
        toMemorize.map((item) =>
          apiRequest('POST', '/invoices/remember-match', {
            rawName: item.rawName,
            ingredientId: item.ingredientId,
          }),
        ),
      );

      const confirmedItems = invoice.items.map((item) => ({
        itemId: item.id,
        ingredientId: item.ingredientId ?? null,
      }));
      const resp = await apiRequest<{ updated: number; created: number; ignored: number }>(
        'POST', `/invoices/${invoice.id}/validate-items`, { items: confirmedItems }
      );
      setImportResult({ updated: resp.updated, created: resp.created });
      setStatus('imported');
    } catch (err: any) {
      setValidateError(err.response?.data?.message ?? 'Échec de la validation. Réessayez.');
      setStatus('done');
    }
  }

  function handleReset() {
    stopPolling();
    setImageUri(null);
    setFileSizeBytes(0);
    setStatus('idle');
    setProgress(0);
    setInvoice(null);
    setErrorMsg('');
    setPermError('');
    setImportResult(null);
    setValidateError('');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.title}>Scanner une facture</Text>
        <Text style={styles.subtitle}>
          Photographiez ou importez une facture fournisseur
        </Text>

        {/* Permission error */}
        {permError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠️ {permError}</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        {!imageUri && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionCard, { marginRight: 8 }]}
              onPress={handleCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.actionEmoji}>📸</Text>
              <Text style={styles.actionLabel}>Prendre une photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { marginLeft: 8 }]}
              onPress={handleGallery}
              activeOpacity={0.8}
            >
              <Text style={styles.actionEmoji}>🖼️</Text>
              <Text style={styles.actionLabel}>Importer depuis la galerie</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Image preview */}
        {imageUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />

            {status === 'idle' && (
              <View style={styles.previewActions}>
                {/* Confirmation header */}
                <View style={styles.confirmHeader}>
                  <Text style={styles.confirmTitle}>C'est bien une facture ?</Text>
                  <Text style={styles.confirmSubtitle}>
                    Vérifiez que la photo est lisible et contient des prix
                  </Text>
                </View>

                {/* File size warning */}
                {fileSizeBytes > 0 && fileSizeBytes < FILE_SIZE_MIN && (
                  <View style={styles.warnCard}>
                    <Text style={styles.warnText}>
                      ⚠️ Photo trop petite, veuillez réessayer
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.analyzeButton}
                  onPress={handleAnalyze}
                  activeOpacity={0.85}
                >
                  <Text style={styles.analyzeButtonText}>Analyser</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleReset}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resetButtonText}>Reprendre</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Progress */}
        {(status === 'uploading' || status === 'polling') && (
          <View style={styles.statusCard}>
            {status === 'uploading' ? (
              <>
                <Text style={styles.statusLabel}>Envoi en cours… {progress}%</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </>
            ) : (
              <>
                <ActivityIndicator color="#16a34a" size="small" style={{ marginBottom: 8 }} />
                <Text style={styles.statusLabel}>Analyse IA en cours…</Text>
                <Text style={styles.statusSub}>
                  {invoice?.status === 'analyzing'
                    ? 'Claude lit votre facture…'
                    : 'En attente de démarrage…'}
                </Text>
              </>
            )}
          </View>
        )}

        {/* Error */}
        {status === 'error' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>❌ {errorMsg}</Text>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset} activeOpacity={0.8}>
              <Text style={styles.resetButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {(status === 'done' || status === 'validating') && invoice && (
          <View style={styles.resultsCard}>
            {/* Summary */}
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>✅ Analyse terminée</Text>
              {invoice.supplierName && (
                <Text style={styles.resultSupplier}>{invoice.supplierName}</Text>
              )}
              {invoice.totalAmount !== null && (
                <Text style={styles.resultTotal}>Total : {fmt(invoice.totalAmount)}</Text>
              )}
              <Text style={styles.resultCount}>
                {invoice.items.length} produit{invoice.items.length !== 1 ? 's' : ''} détecté{invoice.items.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Items list */}
            {invoice.items.map((item) => {
              const method = item.matchMethod;
              const suggestedIng = item.ingredientId
                ? ingredients.find((i) => i.id === item.ingredientId)
                : null;
              const isAuto = method === 'auto' || method === 'memory';
              const isSuggestion = method === 'suggestion';

              return (
                <View
                  key={item.id}
                  style={[
                    styles.itemRow,
                    isAuto ? styles.itemRowAuto : isSuggestion ? styles.itemRowSuggestion : styles.itemRowNone,
                  ]}
                >
                  <View style={styles.itemInfo}>
                    <View style={styles.itemNameRow}>
                      <Text style={styles.itemMatchIcon}>
                        {isAuto ? '✅' : isSuggestion ? '⚠️' : '❓'}
                      </Text>
                      <Text style={styles.itemName}>{item.rawName}</Text>
                    </View>
                    {suggestedIng && (
                      <Text style={[styles.itemDetail, isAuto ? styles.detailGreen : styles.detailOrange]}>
                        → {suggestedIng.name}
                        {item.matchScore !== null && !isAuto
                          ? ` (${Math.round(item.matchScore * 100)}%)`
                          : ''}
                      </Text>
                    )}
                    {!suggestedIng && method === 'none' && (
                      <Text style={styles.detailRed}>Non reconnu</Text>
                    )}
                    {item.quantity !== null && item.unit && (
                      <Text style={styles.itemDetail}>
                        {Number(item.quantity).toFixed(2).replace(/\.?0+$/, '')} {item.unit}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.itemPrice}>{fmt(item.unitPrice)}</Text>
                </View>
              );
            })}

            {/* Validate error */}
            {validateError ? (
              <Text style={styles.validateError}>{validateError}</Text>
            ) : null}

            {/* Validation actions */}
            {status === 'validating' ? (
              <View style={styles.validatingRow}>
                <ActivityIndicator color="#16a34a" size="small" />
                <Text style={styles.validatingText}>Mise à jour des prix…</Text>
              </View>
            ) : (
              <View style={styles.validateActions}>
                <TouchableOpacity
                  style={styles.importButton}
                  onPress={handleValidate}
                  activeOpacity={0.85}
                >
                  <Text style={styles.importButtonText}>✅ Importer dans Chef IA</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ignoreButton}
                  onPress={handleReset}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ignoreButtonText}>✖ Ignorer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Imported success */}
        {status === 'imported' && (
          <View style={styles.importedCard}>
            <Text style={styles.importedTitle}>✅ Importation terminée !</Text>
            {importResult && (
              <Text style={styles.importedSub}>
                {importResult.updated} prix mis à jour · {importResult.created} nouvel{importResult.created !== 1 ? 's' : ''} ingrédient{importResult.created !== 1 ? 's' : ''} créé{importResult.created !== 1 ? 's' : ''}
              </Text>
            )}
            <Text style={styles.importedSub}>Vos food costs ont été recalculés.</Text>
            <TouchableOpacity
              style={styles.dashboardButton}
              onPress={() => router.push('/(tabs)/advisor')}
              activeOpacity={0.85}
            >
              <Text style={styles.dashboardButtonText}>Voir le dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset} activeOpacity={0.8}>
              <Text style={styles.resetButtonText}>Scanner une autre facture</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const GREEN = '#16a34a';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f4',
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  // Web fallback
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  webEmoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  webTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 12,
    textAlign: 'center',
  },
  webText: {
    fontSize: 15,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#78716c',
    marginBottom: 24,
  },
  // Action buttons
  actionRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  actionEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1c1917',
    textAlign: 'center',
  },
  // Preview
  previewContainer: {
    marginBottom: 16,
  },
  preview: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    backgroundColor: '#e7e5e4',
  },
  previewActions: {
    marginTop: 12,
    gap: 8,
  },
  analyzeButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d6d3d1',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  resetButtonText: {
    color: '#57534e',
    fontSize: 14,
    fontWeight: '500',
  },
  // Status
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 8,
  },
  statusSub: {
    fontSize: 13,
    color: '#78716c',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#e7e5e4',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: 3,
  },
  // Error
  errorCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 20,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  // Results
  resultsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  resultHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
    paddingBottom: 12,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15803d',
    marginBottom: 4,
  },
  resultSupplier: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 2,
  },
  resultTotal: {
    fontSize: 14,
    color: '#57534e',
    marginBottom: 2,
  },
  resultCount: {
    fontSize: 13,
    color: '#78716c',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  itemRowAuto: {
    backgroundColor: '#f0fdf4',
  },
  itemRowSuggestion: {
    backgroundColor: '#fffbeb',
  },
  itemRowNone: {
    backgroundColor: '#fef2f2',
  },
  itemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemMatchIcon: {
    fontSize: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1c1917',
    flexWrap: 'wrap',
    flex: 1,
  },
  itemDetail: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 2,
  },
  detailGreen: {
    color: '#15803d',
    fontWeight: '500',
  },
  detailOrange: {
    color: '#b45309',
    fontWeight: '500',
  },
  detailRed: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1917',
  },
  // Validation
  validateError: {
    fontSize: 13,
    color: '#dc2626',
    marginTop: 12,
    textAlign: 'center',
  },
  validatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    paddingVertical: 12,
  },
  validatingText: {
    fontSize: 14,
    color: '#57534e',
    fontWeight: '500',
  },
  validateActions: {
    marginTop: 16,
    gap: 10,
  },
  importButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  importButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  ignoreButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d6d3d1',
    backgroundColor: '#fff',
  },
  ignoreButtonText: {
    color: '#78716c',
    fontSize: 14,
    fontWeight: '500',
  },
  // Imported success
  importedCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  importedTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#15803d',
    textAlign: 'center',
  },
  importedSub: {
    fontSize: 14,
    color: '#166534',
    textAlign: 'center',
    marginBottom: 8,
  },
  dashboardButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '100%',
  },
  dashboardButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Confirmation panel
  confirmHeader: {
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1917',
    marginBottom: 4,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: 13,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 18,
  },
  warnCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  warnText: {
    fontSize: 13,
    color: '#92400e',
    textAlign: 'center',
  },
});
