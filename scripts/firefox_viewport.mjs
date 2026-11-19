// Firefox impone un mínimo a su ventana de escritorio. BiDi permite fijar
// el área de contenido en píxeles CSS, como en la vista adaptable del navegador.
const [address, context, width, height] = process.argv.slice(2);
const socket = new WebSocket(address);
process.exitCode = 1;

socket.addEventListener('open', () => {
  socket.send(JSON.stringify({
    id: 1,
    method: 'browsingContext.setViewport',
    params: {context, viewport: {width: Number(width), height: Number(height)}}
  }));
});
socket.addEventListener('message', ({data}) => {
  const reply = JSON.parse(data);
  if (reply.id !== 1) return;
  if (reply.type === 'success') process.exitCode = 0;
  else console.error(reply.error, reply.message);
  socket.close();
});
socket.addEventListener('error', event => console.error(event.message || 'Falló la conexión con Firefox'));
