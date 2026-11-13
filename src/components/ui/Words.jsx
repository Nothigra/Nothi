/* A title that comes in word by word when it scrolls into view (styles: .nl-words in styles/glass.css). */
export default function Words({ text, start = 0 }) {
  return String(text).split(' ').map((w, i, a) => (
    <span key={i}>
      <span className="w"><span style={{ '--i': start + i }}>{w}</span></span>{i < a.length - 1 ? ' ' : ''}
    </span>
  ));
}
