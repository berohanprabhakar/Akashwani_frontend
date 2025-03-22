const socket = io("https://akashwani-backend.onrender.com/");
let peer;
let myStream;
let isMuted = false;
let remoteSocketId = null; // Stores the socket ID of the remote user

socket.on("connect", () => {
  document.getElementById("socketId").innerText = socket.id;
  console.log("Connected to server as", socket.id);
});

socket.on("callIncoming", async (data) => {
  console.log("Incoming call from:", data.from);
  if (confirm(`Incoming call from ${data.from}. Accept?`)) {
    acceptCall(data.from, data.signal);
  }
});

socket.on("callAccepted", (data) => {
  console.log("Call accepted, connecting...");
  peer.signal(data.signal);

  // 🔹 Update call status for the caller
  document.getElementById("callStatus").innerText = "Connected";

  // 🔹 Hide input field and call button
  document.getElementById("callToId").style.display = "none";
});

socket.on("endCall", () => {
  console.log("Call ended by the other user.");

  if (peer) {
    peer.destroy();
    peer = null;
  }

  document.getElementById("callStatus").innerText = "Idle";
  document.getElementById("callToId").style.display = "block";
});

async function getAudioStream() {
  try {
    myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("✅ Microphone access granted.");
  } catch (error) {
    console.error("❌ Error accessing microphone:", error);
    alert("Please enable microphone permissions.");
  }
}

async function callUser() {
  const userToCall = document.getElementById("callToId").value;
  if (!userToCall) {
    alert("Enter a Socket ID to call.");
    return;
  }
  remoteSocketId = userToCall;

  await getAudioStream();

  peer = new SimplePeer({
    initiator: true,
    trickle: false,
    stream: myStream,
  });

  peer.on("signal", (signal) => {
    socket.emit("callUser", { userToCall, from: socket.id, signal });
  });

  peer.on("stream", (stream) => {
    playRemoteAudio(stream);
  });

  peer.on("connect", () => {
    document.getElementById("callStatus").innerText = "Connected";

    // 🔹 Hide input field and call button
    document.getElementById("callToId").style.display = "none";
  });

  peer.on("close", () => {
    endCall();
  });

  peer.on("error", (err) => {
    console.error("Peer Error:", err);
  });
}

async function acceptCall(from, incomingSignal) {
  remoteSocketId = from;
  await getAudioStream();

  peer = new SimplePeer({
    initiator: false,
    trickle: false,
    stream: myStream,
  });

  peer.on("signal", (signal) => {
    socket.emit("acceptCall", { to: from, signal });
  });

  peer.on("stream", (stream) => {
    playRemoteAudio(stream);
  });

  peer.on("connect", () => {
    document.getElementById("callStatus").innerText = "Connected";

    // 🔹 Hide input field and call button
    document.getElementById("callToId").style.display = "none";
  });

  peer.signal(incomingSignal);
}

function playRemoteAudio(stream) {
  const audioElement = document.getElementById("remoteAudio");
  audioElement.srcObject = stream;
}

function toggleMute() {
  if (!myStream) return;

  isMuted = !isMuted;
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !isMuted));

  document.querySelector(".mute-btn").innerText = isMuted
    ? "🔊 Unmute"
    : "🔇 Mute";
  console.log(isMuted ? "🎙️ Muted" : "🎙️ Unmuted");
}

function endCall() {
  if (peer) {
    console.log("Ending call...");

    // Notify the other user that the call is ending
    socket.emit("endCall", { target: remoteSocketId });

    peer.destroy();
    peer = null;
    document.getElementById("callStatus").innerText = "Idle";
    document.getElementById("callToId").style.display = "block";
  }
}

let isSpeakerOn = false;

function toggleAudio() {
  const audioBtn = document.getElementById("audioToggle");

  if (isSpeakerOn) {
    audioBtn.textContent = "🔊 Speaker";
    audioBtn.style.background = "rgba(255, 255, 255, 0.2)";
    setAudioOutput("default");
  } else {
    audioBtn.textContent = "🎧 Earpiece";
    audioBtn.style.background = "#00d4ff";
    setAudioOutput("speaker");
  }
  isSpeakerOn = !isSpeakerOn;
}

function setAudioOutput(device) {
  if (typeof audioElement !== "undefined" && audioElement.setSinkId) {
    audioElement
      .setSinkId(device)
      .catch((err) => console.error("Audio switch failed", err));
  } else {
    showToast("Audio switching not supported");
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return; // Avoids error if toast is missing

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => {
      toast.classList.remove("show", "hide");
    }, 500);
  }, 2500);
}

function copySocketId() {
  const socketIdElement = document.getElementById("socketId");
  if (!socketIdElement) return;

  const socketId = socketIdElement.textContent;

  navigator.clipboard
    .writeText(socketId)
    .then(() => {
      showToast("✅ Socket ID copied!");
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
      showToast("❌ Failed to copy ID!");
    });
}