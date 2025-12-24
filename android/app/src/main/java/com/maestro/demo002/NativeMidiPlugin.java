package com.maestro.demo002;

import android.content.Context;
import android.content.pm.PackageManager;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiInputPort;
import android.media.midi.MidiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Native MIDI Plugin for Capacitor - SAFE VERSION
 * All methods are wrapped in try-catch to prevent crashes
 */
@CapacitorPlugin(name = "NativeMidi")
public class NativeMidiPlugin extends Plugin {

    private static final String TAG = "NativeMidiPlugin";
    
    private MidiManager midiManager;
    private MidiDevice currentDevice;
    private MidiInputPort currentInputPort;
    private List<MidiDeviceInfo> availableDevices = new ArrayList<>();

    @Override
    public void load() {
        try {
            super.load();
            Context context = getContext();
            
            if (context != null && context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_MIDI)) {
                midiManager = (MidiManager) context.getSystemService(Context.MIDI_SERVICE);
                Log.d(TAG, "MIDI Manager initialized: " + (midiManager != null));
            } else {
                Log.w(TAG, "MIDI feature not available on this device");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in load(): " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        try {
            Log.d(TAG, "listDevices() called");
            
            if (midiManager == null) {
                Log.e(TAG, "midiManager is null");
                JSObject result = new JSObject();
                result.put("devices", new JSArray());
                result.put("count", 0);
                call.resolve(result);
                return;
            }

            availableDevices.clear();
            MidiDeviceInfo[] devices = midiManager.getDevices();
            
            if (devices == null) {
                Log.w(TAG, "getDevices() returned null");
                devices = new MidiDeviceInfo[0];
            }
            
            JSArray deviceList = new JSArray();
            for (int i = 0; i < devices.length; i++) {
                try {
                    MidiDeviceInfo info = devices[i];
                    if (info != null) {
                        availableDevices.add(info);
                        
                        JSObject deviceObj = new JSObject();
                        deviceObj.put("index", i);
                        deviceObj.put("name", getDeviceName(info));
                        
                        String manufacturer = null;
                        if (info.getProperties() != null) {
                            manufacturer = info.getProperties().getString(MidiDeviceInfo.PROPERTY_MANUFACTURER);
                        }
                        deviceObj.put("manufacturer", manufacturer);
                        deviceObj.put("inputPorts", info.getInputPortCount());
                        deviceObj.put("outputPorts", info.getOutputPortCount());
                        deviceList.put(deviceObj);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error processing device " + i + ": " + e.getMessage());
                }
            }
            
            JSObject result = new JSObject();
            result.put("devices", deviceList);
            result.put("count", availableDevices.size());
            
            Log.d(TAG, "Found " + availableDevices.size() + " MIDI devices");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Error in listDevices(): " + e.getMessage(), e);
            call.reject("Error listing devices: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        try {
            Log.d(TAG, "connect() called");
            
            if (midiManager == null) {
                call.reject("MIDI not available");
                return;
            }

            int deviceIndex = call.getInt("deviceIndex", 0);
            Log.d(TAG, "Connecting to device index: " + deviceIndex);
            
            if (availableDevices.isEmpty()) {
                // Re-list devices
                MidiDeviceInfo[] devices = midiManager.getDevices();
                if (devices != null) {
                    for (MidiDeviceInfo info : devices) {
                        if (info != null) {
                            availableDevices.add(info);
                        }
                    }
                }
            }
            
            if (deviceIndex < 0 || deviceIndex >= availableDevices.size()) {
                call.reject("Invalid device index: " + deviceIndex + " (available: " + availableDevices.size() + ")");
                return;
            }

            MidiDeviceInfo deviceInfo = availableDevices.get(deviceIndex);
            if (deviceInfo == null) {
                call.reject("Device info is null");
                return;
            }
            
            final String deviceName = getDeviceName(deviceInfo);
            Log.d(TAG, "Opening device: " + deviceName);

            midiManager.openDevice(deviceInfo, new MidiManager.OnDeviceOpenedListener() {
                @Override
                public void onDeviceOpened(MidiDevice device) {
                    try {
                        if (device == null) {
                            Log.e(TAG, "Device open returned null");
                            new Handler(Looper.getMainLooper()).post(() -> {
                                call.reject("Failed to open MIDI device");
                            });
                            return;
                        }
                        
                        currentDevice = device;
                        Log.d(TAG, "Device opened successfully");
                        
                        // Get device info from the opened device
                        MidiDeviceInfo info = device.getInfo();
                        int inputCount = info != null ? info.getInputPortCount() : 0;
                        
                        if (inputCount > 0) {
                            currentInputPort = device.openInputPort(0);
                            if (currentInputPort != null) {
                                Log.d(TAG, "Input port opened successfully");
                                
                                JSObject result = new JSObject();
                                result.put("success", true);
                                result.put("deviceName", deviceName);
                                
                                new Handler(Looper.getMainLooper()).post(() -> {
                                    call.resolve(result);
                                });
                            } else {
                                Log.e(TAG, "Failed to open input port");
                                new Handler(Looper.getMainLooper()).post(() -> {
                                    call.reject("Failed to open input port");
                                });
                            }
                        } else {
                            Log.w(TAG, "Device has no input ports");
                            new Handler(Looper.getMainLooper()).post(() -> {
                                call.reject("Device has no input ports for sending");
                            });
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error in onDeviceOpened: " + e.getMessage(), e);
                        new Handler(Looper.getMainLooper()).post(() -> {
                            call.reject("Error opening device: " + e.getMessage());
                        });
                    }
                }
            }, new Handler(Looper.getMainLooper()));
            
        } catch (Exception e) {
            Log.e(TAG, "Error in connect(): " + e.getMessage(), e);
            call.reject("Error connecting: " + e.getMessage());
        }
    }

    @PluginMethod
    public void send(PluginCall call) {
        try {
            if (currentInputPort == null) {
                call.reject("No MIDI device connected");
                return;
            }

            JSONArray dataArray = call.getArray("data");
            if (dataArray == null || dataArray.length() == 0) {
                call.reject("Invalid MIDI data");
                return;
            }

            byte[] midiData = new byte[dataArray.length()];
            for (int i = 0; i < dataArray.length(); i++) {
                midiData[i] = (byte) dataArray.getInt(i);
            }
            
            currentInputPort.send(midiData, 0, midiData.length);
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (JSONException e) {
            call.reject("Invalid MIDI data format: " + e.getMessage());
        } catch (IOException e) {
            call.reject("Failed to send MIDI: " + e.getMessage());
        } catch (Exception e) {
            call.reject("Error sending MIDI: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sendTestNote(PluginCall call) {
        try {
            if (currentInputPort == null) {
                call.reject("No MIDI device connected");
                return;
            }

            byte[] noteOn = new byte[] { (byte) 0x90, 60, 100 };
            currentInputPort.send(noteOn, 0, noteOn.length);
            
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    if (currentInputPort != null) {
                        byte[] noteOff = new byte[] { (byte) 0x80, 60, 0 };
                        currentInputPort.send(noteOff, 0, noteOff.length);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error sending note off: " + e.getMessage());
                }
            }, 500);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (IOException e) {
            call.reject("Failed to send test note: " + e.getMessage());
        } catch (Exception e) {
            call.reject("Error sending test note: " + e.getMessage());
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            if (currentInputPort != null) {
                currentInputPort.close();
                currentInputPort = null;
            }
            if (currentDevice != null) {
                currentDevice.close();
                currentDevice = null;
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (Exception e) {
            call.reject("Failed to disconnect: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            boolean available = midiManager != null;
            JSObject result = new JSObject();
            result.put("available", available);
            call.resolve(result);
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("available", false);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        try {
            boolean connected = currentInputPort != null;
            JSObject result = new JSObject();
            result.put("connected", connected);
            call.resolve(result);
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("connected", false);
            call.resolve(result);
        }
    }

    private String getDeviceName(MidiDeviceInfo info) {
        try {
            if (info == null || info.getProperties() == null) {
                return "Unknown MIDI Device";
            }
            String name = info.getProperties().getString(MidiDeviceInfo.PROPERTY_NAME);
            if (name == null || name.isEmpty()) {
                name = info.getProperties().getString(MidiDeviceInfo.PROPERTY_PRODUCT);
            }
            if (name == null || name.isEmpty()) {
                name = "Unknown MIDI Device";
            }
            return name;
        } catch (Exception e) {
            return "Unknown MIDI Device";
        }
    }
}
