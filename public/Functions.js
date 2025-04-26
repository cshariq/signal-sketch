function clearElements(parentId) { 
  const parent = document.getElementById(parentId); 
  while (parent.firstChild) {
     parent.removeChild(parent.firstChild); 
  }
}

function checkEnter(event) {
  if (event.key === 'Enter' && document.querySelector('.textbox').value.trim() !== '') {
    switchSession()
  }
  if (document.querySelector('.textbox').value.trim() == '') {
      document.getElementById('chat-button').style.display = 'none';
  } else {
      document.getElementById('chat-button').style.display = 'flex';
  }
  const textbox = document.querySelector('.textbox');

  textbox.addEventListener('input', () => {
      if (textbox.value.trim() === '') {
          document.getElementById('chat-button').style.display = 'none';
      } else {
          document.getElementById('chat-button').style.display = 'flex';
      }
  });
}

function enter() { 
  switchSession()
}

function clearInput() { 
  document.getElementById('integerInput').value = ''; 
  document.getElementById('chat-button').style.display = 'none';
}

function myFunction() {
  var element = document.body;
  element.classList.toggle("dark-modes");
  // document.body.classList.toggle("dark-modes");
}

fetchWeatherData();


// MESSSAGING STUFF
async function sendChatmessage() {
  const chatSession = {
      message: [
          { role: "user", parts: ["Your first message"] },
          { role: "model", parts: ["Model response"] }
      ]
  };

  chatSession.message.forEach(msg => {
      const text = msg.parts[0];
      console.log(`${msg.role === "user" ? "User" : "Model"}: ${text.slice(7, text.length - 2)}`);
  });

  try {
      const input = document.querySelector('.messagebox').value.trim();
      if (!input) return; // Prevent empty messages

      const newMessage = document.createElement('div');
      newMessage.className = 'message sent';
      newMessage.textContent = input;

      const chatContainer = document.querySelector('.messages');
      chatContainer.insertBefore(newMessage, chatContainer.querySelector('.container'));
      document.querySelector('.messagebox').value = '';
      chatContainer.scrollTop = chatContainer.scrollHeight;

      const response = await fetch('/send_message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input })
      });

      const data = await response.json();
      console.log(data);
  } catch (error) {
      console.error('Error:', error);
  }
  receiveMessage();
}

function receiveMessage() {
  fetch('/receive_message')
      .then(response => response.json())
      .then(data => {
          const text = data.message;
          if (!text) return;

          const newMessage = document.createElement('div');
          newMessage.className = 'message received';
          newMessage.textContent = text;

          const chatContainer = document.querySelector('.messages');
          chatContainer.insertBefore(newMessage, chatContainer.querySelector('.container'));
          chatContainer.scrollTop = chatContainer.scrollHeight;
      })
      .catch(error => console.error('Error:', error));
}

const wxEmojiMap = {
  // Rain (1-12)
  1: "🌧️", 2: "🌧️", 3: "🌧️", 4: "🌧️", 5: "🌧️", 6: "🌧️",
  7: "🌧️", 8: "🌧️", 9: "🌧️", 10: "🌧️", 11: "🌧️", 12: "🌧️",
  
  // Snow (13-18)
  13: "❄️", 14: "❄️", 15: "❄️", 16: "❄️", 17: "❄️", 18: "❄️",
  
  // Fog (19-22)
  19: "🌫️", 20: "🌫️", 21: "🌫️", 22: "🌫️",
  
  // Wind (23-25)
  23: "🌬️", 24: "🌬️", 25: "🌬️",
  
  // Cloudy (26-27)
  26: "☁️", 27: "☁️",
  
  // Partly Cloudy (28-30)
  28: "⛅", 29: "⛅", 30: "⛅",
  
  // Clear Night (31)
  31: "🌙",
  
  // Sunny (32, 36)
  32: "☀️", 36: "☀️",
  
  // Moon with Clouds (33)
  33: "🌥️",
  
  // Mostly Sunny (34)
  34: "🌤️",
  
  // Rain and Snow (35)
  35: "🌨️",
  
  // Thunderstorm (37-40, 47)
  37: "⛈️", 38: "⛈️", 39: "⛈️", 40: "⛈️", 47: "⛈️",
  
  // Snow (41-43, 46)
  41: "🌨️", 42: "🌨️", 43: "🌨️", 46: "🌨️",
  
  // Rain (45)
  45: "🌧️",
  
  // Default
  default: "🌈"
};

function processWeatherData(data) {
  console.log("Processing data")
  console.log(data)
  console.log(data.conditionsshort.observation.wx_icon)
}

processWeatherData()
function checkEnterChat(event) {
  const textbox = document.querySelector('.messagebox');
  const chatButton = document.getElementById('sendIcon');

  if (event.key === 'Enter' && textbox.value.trim() !== '') {
    sendChatmessage();
  }

  if (chatButton) { // Ensure chatButton exists before accessing its properties
      chatButton.style.display = textbox.value.trim() === '' ? 'none' : 'flex';
  }

  textbox.addEventListener('input', () => {
      if (chatButton) { // Check again inside event listener
          chatButton.style.display = textbox.value.trim() === '' ? 'none' : 'flex';
      }
  });
}


document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("chatContainer").scrollTop = document.getElementById("chatContainer").scrollHeight;
});