import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, StatusBar, TextInput, Vibration } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons'; 

const API_URL = 'http://192.168.0.59:3000';

export default function App() {
  const [status, setStatus] = useState("SYSTEM READY");
  const [statusColor, setStatusColor] = useState("#FFD700"); 
  const [showLoginRequest, setShowLoginRequest] = useState(false);
  const [secureNonce, setSecureNonce] = useState("");
  
  // Pairing States
  const [isPaired, setIsPaired] = useState(false);
  const [deviceUser, setDeviceUser] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [myDeviceId, setMyDeviceId] = useState("");

  // Hacker State
  const [hackerTarget, setHackerTarget] = useState("");

  // --- 1. BOOT SEQUENCE: CHECK FOR SAVED IDENTITY ---
  useEffect(() => {
    async function bootSystem() {
      const savedUser = await SecureStore.getItemAsync('capsule_user');
      let savedDeviceId = await SecureStore.getItemAsync('capsule_device_id');
      
      if (!savedDeviceId) {
        savedDeviceId = 'DEV-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await SecureStore.setItemAsync('capsule_device_id', savedDeviceId);
      }
      setMyDeviceId(savedDeviceId);

      if (savedUser) {
        setDeviceUser(savedUser);
        setIsPaired(true);
        setStatus("SYSTEM ACTIVE: LISTENING...");
        setStatusColor("#00FF00");
      }
    }
    bootSystem();
  }, []);

  // --- 2. PAIRING LOGIC ---
  const handlePairDevice = async () => {
    if (!deviceUser || !passwordInput) return Alert.alert("Error", "Enter ID and Password");
    setStatus("VERIFYING CREDENTIALS...");
    
    try {
      const res = await fetch(`${API_URL}/api/pair-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: deviceUser, password: passwordInput, deviceId: myDeviceId })
      });
      const data = await res.json();

      if (data.success) {
        await SecureStore.setItemAsync('capsule_user', deviceUser);
        setIsPaired(true);
        setStatus("SYSTEM ACTIVE: LISTENING...");
        setStatusColor("#00FF00");
        Alert.alert("PAIRED", `This device is now permanently linked to ${deviceUser}.`);
      } else {
        setStatus("PAIRING FAILED");
        setStatusColor("#FF0000");
        Alert.alert("Pairing Failed", data.error || "Incorrect Credentials");
      }
    } catch (e) {
      Alert.alert("Network Error", "Cannot reach server.");
    }
  };

  const unpairDevice = async () => {
    await SecureStore.deleteItemAsync('capsule_user');
    setIsPaired(false);
    setDeviceUser("");
    setPasswordInput("");
    setStatus("SYSTEM READY");
    setStatusColor("#FFD700");
  };

  // --- 3. SECURE BACKGROUND LISTENER ---
  useEffect(() => {
    if (!isPaired) return;

    const interval = setInterval(async () => {
        if (!showLoginRequest) {
            try {
                const response = await fetch(`${API_URL}/simulated-push?username=${deviceUser}&deviceId=${myDeviceId}`);
                const data = await response.json();
                
                if (data.success) {
                    Vibration.vibrate([0, 500, 200, 500]); 
                    setSecureNonce(data.nonce);
                    setShowLoginRequest(true);
                }
            } catch (error) {}
        }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPaired, deviceUser, showLoginRequest, myDeviceId]);


  // --- 4. BIOMETRIC RESPONSE ---
  const handleBiometricAuth = async () => {
    try {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'VERIFY SAIYAN ID',
            fallbackLabel: 'ENTER PASSCODE',
        });
        if (result.success) grantAccess();
        else { setStatus("ACCESS DENIED"); setStatusColor("#FF0000"); setShowLoginRequest(false); }
    } catch (e) { Alert.alert("Error", "Face ID failed."); }
  };

  const grantAccess = async () => {
      setStatus("TRANSMITTING...");
      setStatusColor("#007AFF"); 
      setShowLoginRequest(false);
      
      try {
        const res = await fetch(`${API_URL}/auth-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: deviceUser, approved: true, returnedNonce: secureNonce, returnedTimestamp: Date.now() })
        });
        const data = await res.json();
        
        if (data.success) {
            setStatus("ACCESS GRANTED");
            setStatusColor("#FFD700"); 
            setTimeout(() => { setStatus("SYSTEM ACTIVE: LISTENING..."); setStatusColor("#00FF00"); }, 3000);
        } else {
            Alert.alert("MITM Blocked", data.error);
        }
      } catch (err) {}
  }

  // --- 5. HACKER INTERCEPT SIMULATION ---
  const simulateHackerIntercept = async () => {
      if(!hackerTarget) return Alert.alert("Target Required", "Enter the target username to intercept.");
      setStatus("INTERCEPTING...");
      setStatusColor("#FF0000");

      try {
          // The phone maliciously asks for SOMEONE ELSE'S push notification!
          const response = await fetch(`${API_URL}/simulated-push?username=${hackerTarget}&deviceId=${myDeviceId}`);
          const data = await response.json();

          if (data.success) {
              setSecureNonce(data.nonce);
              setShowLoginRequest(true);
          } else {
              // Proves it works! The server catches the mismatch.
              Alert.alert("MITM BLOCKED", `Server rejected intercept!\nUnrecognized hardware token for user: ${hackerTarget}.`);
              setStatus("SYSTEM ACTIVE: LISTENING...");
              setStatusColor("#00FF00");
          }
      } catch (e) {
          Alert.alert("Error", "Network error");
      }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.scouterLine} />

      <View style={styles.header}>
        <View style={styles.logoContainer}>
            <Ionicons name="planet" size={60} color="#1a1a2e" />
        </View>
        <Text style={styles.corpTitle}>CAPSULE CORP</Text>
        <Text style={styles.subTitle}>SECURE TERMINAL</Text>

        <View style={[styles.statusBox, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            STATUS: {status}
          </Text>
        </View>
      </View>

      {!isPaired ? (
        <View style={styles.controls}>
            <Text style={{color: '#0ff', textAlign: 'center', marginBottom: 20, fontWeight: 'bold'}}>DEVICE UNREGISTERED. HARDWARE LINK REQUIRED.</Text>
            
            <Text style={styles.label}>OPERATIVE ID</Text>
            <TextInput style={styles.userInput} value={deviceUser} onChangeText={setDeviceUser} autoCapitalize="none" placeholder="Username" />
            
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput style={styles.userInput} value={passwordInput} onChangeText={setPasswordInput} secureTextEntry placeholder="Password" />

            <TouchableOpacity style={styles.actionButton} onPress={handlePairDevice}>
                <Ionicons name="lock-closed" size={20} color="#1a1a2e" style={{marginRight: 10}}/>
                <Text style={styles.buttonText}>LINK HARDWARE</Text>
            </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.controls}>
            <Text style={styles.label}>PAIRED TO OPERATIVE</Text>
            <Text style={[styles.userInput, {backgroundColor: 'transparent', color: '#0ff', fontSize: 24, padding: 0, borderWidth: 0}]}>{deviceUser.toUpperCase()}</Text>
            
            <Text style={{color: '#aaa', textAlign: 'center', marginTop: 10, fontStyle: 'italic', fontSize: 12}}>
                Hardware Token: {myDeviceId.substring(0, 10)}...
            </Text>

            <TouchableOpacity onPress={unpairDevice} style={{marginTop: 15, alignItems: 'center'}}>
                <Text style={{color: '#f00', fontSize: 12, fontWeight: 'bold'}}>UNPAIR DEVICE (DANGER)</Text>
            </TouchableOpacity>

            {/* THE HACKER TOOL BOX */}
            <View style={styles.hackerBox}>
                <Text style={styles.hackerTitle}>TEST: MAN-IN-THE-MIDDLE ATTACK</Text>
                <TextInput 
                    style={[styles.userInput, {borderColor: '#f00', color: '#f00', marginBottom: 10, fontSize: 14, padding: 8}]}
                    placeholder="Enter ID"
                    placeholderTextColor="#888"
                    autoCapitalize="none"
                    value={hackerTarget}
                    onChangeText={setHackerTarget}
                />
                <TouchableOpacity style={styles.hackerBtn} onPress={simulateHackerIntercept}>
                    <Text style={{color: '#fff', textAlign: 'center', fontWeight: 'bold', fontSize: 12}}>INTERCEPT PAYLOAD</Text>
                </TouchableOpacity>
            </View>

        </View>
      )}

      {/* POPUP SCREEN */}
      {showLoginRequest && (
        <View style={styles.overlay}>
          <View style={styles.popup}>
            <Text style={styles.popupHeader}>INCOMING TRANSMISSION</Text>
            
            <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>TARGET ID:</Text>
                <Text style={styles.infoValue}>{deviceUser}</Text>
                <Text style={styles.infoLabel}>SECURE NONCE:</Text>
                <Text style={styles.infoValue}>{secureNonce.substring(0, 12)}...</Text>
            </View>
            
            <View style={styles.popupButtons}>
              <TouchableOpacity style={[styles.smallButton, { backgroundColor: '#34C759' }]} onPress={handleBiometricAuth}>
                <Text style={styles.smallButtonText}>VERIFY (FACE ID)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallButton, { backgroundColor: '#f00' }]} onPress={() => setShowLoginRequest(false)}>
                <Text style={styles.smallButtonText}>BLOCK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 20 },
  scouterLine: { position: 'absolute', top: 50, left: 0, right: 0, height: 2, backgroundColor: '#F85B1A', opacity: 0.5 },
  header: { alignItems: 'center', marginBottom: 30, borderWidth: 2, borderColor: '#072083', padding: 20, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
  logoContainer: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F85B1A', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 4, borderColor: '#fff' },
  corpTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  subTitle: { fontSize: 14, color: '#F85B1A', letterSpacing: 4, marginBottom: 20 },
  statusBox: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 2, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.5)', minWidth: '100%', alignItems: 'center' },
  statusText: { fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  controls: { padding: 20, borderTopWidth: 1, borderTopColor: '#333' },
  label: { color: '#555', marginBottom: 5, textAlign: 'center', letterSpacing: 2, fontSize: 12 },
  userInput: { backgroundColor: '#fff', padding: 12, borderRadius: 8, textAlign: 'center', fontWeight: 'bold', fontSize: 16, color: '#072083', borderWidth: 2, borderColor: '#F85B1A', marginBottom: 15 },
  actionButton: { flexDirection: 'row', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 15, backgroundColor: '#F85B1A', borderWidth: 2, borderColor: '#fff', shadowColor: '#F85B1A', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  buttonText: { color: '#1a1a2e', fontWeight: '900', fontSize: 18 },
  hackerBox: { marginTop: 30, padding: 15, borderWidth: 2, borderColor: '#f00', borderRadius: 12, backgroundColor: 'rgba(255,0,0,0.1)' },
  hackerTitle: { color: '#f00', fontSize: 12, textAlign: 'center', marginBottom: 10, fontWeight: 'bold', letterSpacing: 1 },
  hackerBtn: { backgroundColor: '#f00', padding: 12, borderRadius: 8 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 100 },
  popup: { width: '100%', backgroundColor: '#fff', padding: 25, borderRadius: 20, alignItems: 'center', borderWidth: 5, borderColor: '#F85B1A' },
  popupHeader: { fontSize: 20, fontWeight: '900', marginBottom: 15, color: '#072083' },
  infoBox: { width: '100%', backgroundColor: '#eee', padding: 15, borderRadius: 10, marginBottom: 20 },
  infoLabel: { fontSize: 10, color: '#666', fontWeight: 'bold' },
  infoValue: { fontSize: 16, color: '#333', fontWeight: 'bold', marginBottom: 10, fontFamily: 'monospace' },
  popupButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 15 },
  smallButton: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
  smallButtonText: { color: 'white', fontWeight: 'bold', fontSize: 12 }
});