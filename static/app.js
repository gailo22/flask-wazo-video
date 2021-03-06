const usernameInput = document.getElementById('username');
const button = document.getElementById('join_leave');
const participants = document.getElementById('participants');
const count = document.getElementById('count');
var connected = false;
var room;

var connect = async () => {
  // get a token from the back end
  var username = usernameInput.value;
  if (!username) {
    alert('Enter your name before connecting');
    return;
  }
  button.disabled = true;
  button.innerHTML = 'Connecting...';

  const data = await fetch('/login', { method: 'POST', body: JSON.stringify({ 'username': username }) }).then(res => res.json());
  if (!data) {
    alert('Could not obtain token. Is the backend running?');
    button.innerHTML = 'Join call';
    button.disabled = false;
  }

  Wazo.Auth.setHost(data.host);
  await Wazo.Auth.validateToken(data.session.token);

  room = await Wazo.Room.connect({ extension: data.room, audio: true, video: true, extra: { username } });
  room.on(room.ON_JOINED, () => {
    connected = true;
    updateParticipantCount();
    button.innerHTML = 'Leave call';
    button.disabled = false;
  });

  room.on(room.CONFERENCE_USER_PARTICIPANT_JOINED, participantConnected);
  room.on(room.CONFERENCE_USER_PARTICIPANT_LEFT, participantDisconnected);
};

const disconnect = () => {
  room.disconnect();
  while (participants.childNodes.length > 0) {
    participants.removeChild(participants.lastChild);
  }
  button.innerHTML = 'Join call';
  connected = false;
  updateParticipantCount();
};

const submitButtonHandler = (event) => {
  event.preventDefault();
  if (!connected) {
    connect();
  } else {
    disconnect();
  }
};

function addLocalVideo() {
  Wazo.createLocalVideoStream().then(stream => {
    var video = document.getElementById('local').firstElementChild;
    video.appendChild(stream.attach());
    video.style.transform = 'scale(-1, 1)'; 
  });
}

const participantConnected = (participant) => {
  // check if the participant is not already displayed
  if (document.getElementById(participant.callId) || participant instanceof Wazo.LocalParticipant) {
    return;
  }
  var div = addParticipantDiv(participant.callId, participant.extra.username || participant.name);

  participant.streams.forEach(stream => {
    streamSubscribed(div, stream);
  });
  participant.on(participant.ON_STREAM_SUBSCRIBED, stream => {
    streamSubscribed(div, stream);
  });

  participant.on(participant.ON_UPDATED, () => {
    const label = div.querySelector('span');
    label.innerHTML = participant.extra.username;
  });

  updateParticipantCount();
};

const addParticipantDiv = (callId, name) => {
  var participant = document.createElement('div');
  participant.setAttribute('id', callId);
  participant.setAttribute('class', 'participant');

  var video = document.createElement('video');
  video.style.width = '240px';
  video.style.height = '180px';
  participant.appendChild(video);

  var label = document.createElement('span');
  label.style.display = 'block';
  label.innerHTML = name;
  participant.appendChild(label);

  participants.appendChild(participant);
  return participant;
};

const participantDisconnected = (participant) => {
  document.getElementById(participant.callId).remove();
  updateParticipantCount();
};

const streamSubscribed = (div, wazoStream) => {
  const video = div.querySelector('video');
  wazoStream.attach(video);
};

const updateParticipantCount = () => {
  if (!connected) {
    count.innerHTML = 'Disconnected.';
  } else {
    count.innerHTML = (room.participants.filter(p => p instanceof Wazo.RemoteParticipant).length + 1) + ' participant(s) online.';
  }
};

addLocalVideo();
button.addEventListener('click', submitButtonHandler);
