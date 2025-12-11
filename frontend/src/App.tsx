import React, { useState } from "react";
import { 
  useAuthModal, 
  useUser, 
  useSigner, 
  useLogout,
  useSmartAccountClient,
  useAddPasskey
} from "@account-kit/react";
import { createLocalClient, sendLocalTestTransaction } from "./localClient";

// Check if we're in local development mode
const USE_LOCAL = import.meta.env.VITE_USE_LOCAL === "true";

export default function App() {
  const { openAuthModal } = useAuthModal();
  const user = useUser();
  const { logout } = useLogout();
  const signer = useSigner();
  const { addPasskey, isAddingPasskey } = useAddPasskey();

  // Account Kit's client - only used when not in local mode
  // This hook may return undefined if user is not logged in
  const smartAccountResult = useSmartAccountClient({
    type: "LightAccount",
  });
  const alchemyClient = smartAccountResult?.client;

  const [isSigning, setIsSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isSendingTx, setIsSendingTx] = useState(false);

  const handleSignMessage = async () => {
    if (!signer) return;
    setIsSigning(true);
    try {
      const message = "Hello from Alchemy Account Kit!";
      const sig = await signer.signMessage(message);
      setSignature(sig);
      console.log("Signature:", sig);
    } catch (error) {
      console.error("Signing failed:", error);
    } finally {
      setIsSigning(false);
    }
  };

  const handleSendTx = async () => {
    if (!signer || !user?.address) return;
    setIsSendingTx(true);
    
    try {
      let hash: string;
      
      if (USE_LOCAL) {
        // Use local client for local Bundler/Anvil
        console.log("Sending tx via LOCAL Bundler...");
        const localClient = await createLocalClient(signer);
        hash = await sendLocalTestTransaction(localClient);
      } else {
        // Use Account Kit's client (Alchemy Bundler)
        if (!alchemyClient) {
          throw new Error("Alchemy client not ready");
        }
        console.log("Sending tx via ALCHEMY Bundler...");
        const result = await alchemyClient.sendUserOperation({
          uo: {
            target: user.address as `0x${string}`,
            data: "0x",
            value: 0n,
          },
        });
        hash = await alchemyClient.waitForUserOperationTransaction(result);
      }
      
      setTxHash(hash);
      console.log("Tx Sent:", hash);
    } catch (error: any) {
      console.error("Tx Failed:", error);
      alert(`Tx Failed: ${error.message}`);
    } finally {
      setIsSendingTx(false);
    }
  };


  const handleLogin = () => {
    const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY;
    console.log("Attempting login...");
    if (!apiKey || apiKey === "YOUR_ALCHEMY_API_KEY") {
      alert("Error: VITE_ALCHEMY_API_KEY is not set in .env file!");
      return;
    }
    
    try {
      openAuthModal();
    } catch (e) {
      console.error("Failed to open auth modal:", e);
      alert("Failed to open login modal. Check console for details.");
    }
  };

  return (
    <div className="min-h-screen bg-cute-bg flex flex-col items-center justify-center p-4 font-cute relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-cute-yellow rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float"></div>
      <div className="absolute top-0 right-10 w-32 h-32 bg-cute-pink rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float" style={{ animationDelay: "2s" }}></div>
      <div className="absolute -bottom-8 left-20 w-32 h-32 bg-cute-purple rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float" style={{ animationDelay: "4s" }}></div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border-4 border-white relative z-10">
        <h1 className="text-4xl font-extrabold mb-8 text-center text-cute-gradient drop-shadow-sm flex items-center justify-center gap-2">
          <span>✨</span> Passkey PoC <span>✨</span>
        </h1>
        
        {!user ? (
          <div className="flex flex-col gap-6 items-center">
            <div className="text-6xl animate-wiggle">🐰</div>
            <p className="text-cute-text text-center text-lg font-bold opacity-80">
              Welcome back! <br/>
              Please login to continue
            </p>
            <button
              onClick={handleLogin}
              style={{ backgroundColor: '#FF69B4', color: 'white', border: '2px solid black', padding: '10px 20px', fontSize: '1.25rem', borderRadius: '1rem', cursor: 'pointer' }}
              className="w-full shadow-md transition-all duration-300 flex items-center justify-center gap-2"
            >
              <span>Login with Passkey</span> <span>🔑</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="bg-cute-blue/30 p-6 rounded-2xl border-2 border-white shadow-inner">
              <h2 className="text-sm font-black text-cute-text/60 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>👤</span> User Info
              </h2>
              <div className="space-y-3">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-cute-text/50 uppercase">Email</span>
                  <span className="text-cute-text font-bold truncate">{user.email || "No Email"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-cute-text/50 uppercase">User Address</span>
                  <span className="text-cute-text font-mono text-xs bg-white/50 p-2 rounded-lg truncate border border-white">
                    {user.address}
                  </span>
                </div>
                {alchemyClient && (
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-cute-text/50 uppercase">Smart Account</span>
                    <span className="text-cute-text font-mono text-xs bg-white/50 p-2 rounded-lg truncate border border-white">
                      {alchemyClient.account.address}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSignMessage}
                disabled={isSigning}
                style={{ backgroundColor: '#9370DB', color: 'white', border: 'none', padding: '12px 24px', fontSize: '1rem', borderRadius: '12px', cursor: 'pointer', marginBottom: '10px' }}
                className="w-full shadow-sm hover:bg-purple-300 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSigning ? "Signing... ✍️" : "Sign Message 📝"}
              </button>

              <button
                 onClick={() => addPasskey()}
                 disabled={isAddingPasskey}
                 style={{ backgroundColor: '#00BFFF', color: 'white', border: 'none', padding: '12px 24px', fontSize: '1rem', borderRadius: '12px', cursor: 'pointer', marginBottom: '10px' }}
                 className="w-full shadow-sm hover:bg-blue-300 hover:-translate-y-1 transition-all disabled:opacity-50"
              >
                {isAddingPasskey ? "Adding Passkey..." : "Register Passkey 🔑"}
              </button>
              
              <button
                onClick={() => logout()}
                style={{ backgroundColor: 'white', color: '#FF69B4', border: '2px solid #FF69B4', padding: '12px 24px', fontSize: '1rem', borderRadius: '12px', cursor: 'pointer' }}
                className="w-full hover:bg-cute-pink hover:text-white transition-all shadow-sm"
              >
                Logout 👋
              </button>
            </div>

            {signature && (
              <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 animate-pulse">
                <h3 className="text-green-600 font-bold mb-2 flex items-center gap-2">
                  <span>✅</span> Signature Created!
                </h3>
                <p className="font-mono text-[10px] text-green-500 break-all bg-white p-2 rounded-lg border border-green-100">
                  {signature}
                </p>
              </div>
            )}

            <button
               onClick={handleSendTx}
               disabled={isSendingTx}
               style={{ backgroundColor: '#FF4500', color: 'white', border: 'none', padding: '12px 24px', fontSize: '1rem', borderRadius: '12px', cursor: 'pointer', marginTop: '10px' }}
               className="w-full shadow-sm hover:bg-orange-600 hover:-translate-y-1 transition-all disabled:opacity-50"
            >
              {isSendingTx ? "Sending Tx... 💸" : "Send 0 ETH (Test Tx) 💸"}
            </button>

            {txHash && (
              <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-200">
                <h3 className="text-blue-600 font-bold mb-2 flex items-center gap-2">
                  <span>🚀</span> Tx Sent!
                </h3>
                <p className="font-mono text-[10px] text-blue-500 break-all bg-white p-2 rounded-lg border border-blue-100">
                  Hash: {txHash}
                </p>
                <a 
                  href={`https://dashboard.tenderly.co/tx/${txHash}`} // Fallback View
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline mt-2 block"
                >
                  View Explorer
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      
      <p className="absolute bottom-4 text-cute-text/30 text-xs font-bold">
        Powered by Alchemy Account Kit 🧪
      </p>
    </div>
  );
}
