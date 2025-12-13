import React, { useState, useEffect } from "react";
import { createAlchemySmartAccountClient } from "@lib/smartAccountClient";
import { 
    createPasskeyCredential, 
    credentialStorage, 
    createAlchemyWebAuthnParams 
} from "@lib/webauthnSigner";

const CREDENTIAL_KEY = "poc_user";

export default function App() {
  const [smartAccount, setSmartAccount] = useState<any>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper to initialize account from stored credential
  const initAccount = async () => {
    try {
        const params = await createAlchemyWebAuthnParams(CREDENTIAL_KEY);
        if (!params) return; // No credential found

        setLoading(true);
        console.log("Initializing Smart Account with params:", params);

        const { smartAccountClient } = await createAlchemySmartAccountClient({
            passkeyParams: params,
            bundlerUrl: "http://127.0.0.1:3000",
        });

        setSmartAccount(smartAccountClient);
        setAddress(smartAccountClient.account.address);
        console.log("Smart Account Address:", smartAccountClient.account.address);

    } catch (err: any) {
        console.error("Init failed:", err);
        setError("Init Failed: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  // Check for existing session on mount
  useEffect(() => {
      initAccount();
  }, []);

  const handleRegister = async () => {
    try {
      setLoading(true);
      setError(null);
      const username = `User ${new Date().toLocaleTimeString()}`;
      
      console.log("Creating Passkey...");
      const credential = await createPasskeyCredential("user_" + Date.now(), username);
      
      console.log("Passkey Created:", credential);
      credentialStorage.save(CREDENTIAL_KEY, credential);

      await initAccount();

    } catch (err: any) {
      console.error("Registration failed:", err);
      setError("Registration Failed: " + err.message);
      setLoading(false);
    }
  };

  const handleLogin = async () => {
     // For this flow, "Login" essentially means re-initializing the account
     // using the stored credential ID. The actual authentication (signing) 
     // happens when sending a transaction.
     // If we wanted to force an authentication check now, we could sign a dummy message.
     
     await initAccount();
  };

  const handleSendTx = async () => {
    if (!smartAccount || !address) return;
    try {
      setLoading(true);
      setTxHash(null);
      console.log("Sending UserOp...");

      // Example UserOp: Send 0 ETH to self
      const userOpResult = await smartAccount.sendUserOperation({
        uo: {
          target: address as `0x${string}`,
          data: "0x",
          value: 0n,
        },
      });

      console.log("UserOp Sent, Hash:", userOpResult.hash);
      const hash = await smartAccount.waitForUserOperationTransaction(userOpResult);
      
      setTxHash(hash);
      console.log("Transaction Mined:", hash);

    } catch (err: any) {
      console.error("Tx Failed:", err);
      setError("Transaction Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Dummy handlers for UI consistency if needed, or remove them
  const handleSignMessage = async () => {
      // Not implemented in this simplified flow
      alert("Sign Message not implemented in this demo");
  };

  return (
    <div className="min-h-screen bg-cute-bg flex flex-col items-center justify-center p-4 font-cute relative overflow-hidden">
      {/* Decorations */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-cute-yellow rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float"></div>
      <div className="absolute top-0 right-10 w-32 h-32 bg-cute-pink rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float" style={{ animationDelay: "2s" }}></div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border-4 border-white relative z-10">
        <h1 className="text-4xl font-extrabold mb-8 text-center text-cute-gradient drop-shadow-sm flex items-center justify-center gap-2">
          <span>✨</span> Alchemy SDK Passkey <span>✨</span>
        </h1>

        {error && (
            <div className="bg-red-100 border-2 border-red-200 text-red-600 p-3 rounded-xl mb-4 text-xs font-bold break-words">
                ⚠️ {error}
            </div>
        )}

        {!address ? (
          <div className="flex flex-col gap-4">
            <div className="text-6xl text-center animate-bounce mb-4">🔐</div>
            <p className="text-center text-cute-text font-bold mb-4">
               {loading ? "Processing..." : "Login or Register to create your Smart Account"}
            </p>
            
            <div className="flex gap-3">
                <button
                onClick={handleRegister}
                disabled={loading}
                className="flex-1 bg-cute-pink text-white border-2 border-black p-3 rounded-xl text-lg font-bold shadow-md hover:-translate-y-1 active:translate-y-0 transition-transform disabled:opacity-50"
                >
                Register 🆕
                </button>
                <button
                onClick={handleLogin}
                disabled={loading}
                 className="flex-1 bg-cute-blue text-white border-2 border-black p-3 rounded-xl text-lg font-bold shadow-md hover:-translate-y-1 active:translate-y-0 transition-transform disabled:opacity-50"
                >
                Login 🔑
                </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="bg-white/60 p-4 rounded-2xl border-2 border-white">
                <h2 className="text-xs font-black text-cute-text/50 uppercase tracking-widest mb-2">Smart Account Address</h2>
                <div className="font-mono text-xs bg-white p-2 rounded-lg border border-gray-100 truncate text-cute-text">
                    {address}
                </div>
            </div>

            <button
              onClick={handleSendTx}
              disabled={loading}
              className="w-full bg-cute-purple text-white border-2 border-black p-4 rounded-2xl text-xl font-bold shadow-lg hover:-translate-y-1 active:translate-y-0 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Sending..." : "Send Test Tx 🚀"}
            </button>

            {txHash && (
               <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 animate-fadeIn">
                 <h3 className="text-green-600 font-bold mb-2 flex items-center gap-2">
                   <span>✅</span> Success!
                 </h3>
                 <div className="font-mono text-[10px] text-green-600 break-all bg-white p-2 rounded-lg">
                    {txHash}
                 </div>
               </div>
            )}
            
            <button 
                onClick={() => { setSmartAccount(null); setAddress(null); setTxHash(null); }}
                className="text-xs text-cute-text/50 underline hover:text-cute-pink mt-4 text-center"
            >
                Disconnect / Reset
            </button>
          </div>
        )}
      </div>
      
      <p className="absolute bottom-4 text-cute-text/30 text-xs font-bold text-center">
        Chain ID: 1946 (Soneium Minato Fork)<br/>
        Factory: {(() => {
            const short = "0x00000000000017c61b5bEe81050EC8eFc9c6fecd";
            return short.slice(0, 6) + "..." + short.slice(-4);
        })()}
      </p>
    </div>
  );
}

