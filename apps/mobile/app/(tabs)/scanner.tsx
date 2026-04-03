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
import { api } from '../../src/api/client';

// expo-image-picker is not supported on web — load it only on native
const ImagePicker = Platform.OS !== 'web'
  ? require('expo-image-picker')
  : null;

// ── Types ──────────────────────────────────────────────────────────────────

type UploadStatus = 'idle' | 'uploading' | 'polling' | 'done' | 'error';

interface InvoiceItem {
  id: number;
  rawName: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
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
        <Text style={styles.webTitle}>Fonctionnalité mobile</Text>
        <Text style={styles.webText}>
          La caméra est disponible uniquement sur l'app mobile.{'\n'}
          Utilisez la version iPhone / Android pour scanner vos factures.
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

function ScannerNative() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [permError, setPermError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

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
      resetAndSetImage(result.assets[0].uri);
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
      resetAndSetImage(result.assets[0].uri);
    }
  }

  function resetAndSetImage(uri: string) {
    stopPolling();
    setImageUri(uri);
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
      const res = await api.post<Invoice>('/invoices/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      const invoiceId = res.data.id;
      setStatus('polling');
      setProgress(100);

      // Poll every 3s until analysis is done
      pollRef.current = setInterval(async () => {
        try {
          const poll = await api.get<Invoice>(`/invoices/${invoiceId}`);
          setInvoice(poll.data);

          if (poll.data.status === 'reviewed' || poll.data.status === 'validated') {
            stopPolling();
            setStatus('done');
          } else if (poll.data.status === 'error') {
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

  function handleReset() {
    stopPolling();
    setImageUri(null);
    setStatus('idle');
    setProgress(0);
    setInvoice(null);
    setErrorMsg('');
    setPermError('');
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
                <TouchableOpacity
                  style={styles.analyzeButton}
                  onPress={handleAnalyze}
                  activeOpacity={0.85}
                >
                  <Text style={styles.analyzeButtonText}>Analyser cette facture</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleReset}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resetButtonText}>Changer de fichier</Text>
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
        {status === 'done' && invoice && (
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
            {invoice.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.rawName}</Text>
                  {item.quantity !== null && item.unit && (
                    <Text style={styles.itemDetail}>
                      {Number(item.quantity).toFixed(2).replace(/\.?0+$/, '')} {item.unit}
                    </Text>
                  )}
                </View>
                <Text style={styles.itemPrice}>{fmt(item.unitPrice)}</Text>
              </View>
            ))}

            {/* Scan another */}
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
              activeOpacity={0.8}
            >
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
    borderBottomWidth: 1,
    borderBottomColor: '#fafaf9',
  },
  itemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1c1917',
    flexWrap: 'wrap',
  },
  itemDetail: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1917',
  },
});
