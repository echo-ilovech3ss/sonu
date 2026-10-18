import Reveal from './Reveal';

const steps = [
  {
    number: '01',
    title: 'Pick your pair',
    body: 'Choose a colorway and a size. Add it to the bag. That is the whole product decision.',
  },
  {
    number: '02',
    title: 'Leave an address',
    body: 'Name, email, address, city, PIN. No password, no account, no newsletter checkbox.',
  },
  {
    number: '03',
    title: 'Keep your code',
    body: 'We make a tracking code when the order lands. Use it here anytime. It is saved on this device too.',
  },
];

export default function HowItWorks() {
  return (
    <section className="section how" id="how" aria-labelledby="how-title">
      <div className="shell">
        <div className="section-head section-head--how">
          <div>
            <p className="eyebrow">GUEST CHECKOUT / NO ACCOUNT</p>
            <h2 id="how-title">
              Three steps.
              <br />
              Then walk.
            </h2>
          </div>
          <p>
            We do not need a profile to sell you a pair of shoes. The order
            lives on our server. The tracking code lives with you.
          </p>
        </div>

        <div className="steps">
          {steps.map((step, index) => (
            <Reveal className="step" delay={index * 90} key={step.number}>
              <span className="step__number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </Reveal>
          ))}
        </div>

        <div className="how__strip">
          <span>NO ACCOUNT</span>
          <span>NO PASSWORD</span>
          <span>NO MARKETING LIST</span>
          <span>JUST A TRACKING CODE</span>
        </div>
      </div>
    </section>
  );
}
