import { Kafka, logLevel } from "kafkajs";

const kafka = new Kafka({
  brokers: ["up-toad-10771-us1-kafka.upstash.io:9092"],
  ssl: true,
  sasl: {
    mechanism: "scram-sha-256",
    username: "dXAtdG9hZC0xMDc3MSTU-joGtZ0oC5oCh1d4POc2KDN8QroYSUNmkDctpWE8WD8",
    password: "MzAyZjQ5YTctMTIzZC00MGM4LWI4NTQtNzUwNTZjOWNiMTUy",
  },
  logLevel: logLevel.ERROR,
});

const producer = kafka.producer();

export const produce = async (topic, url) => {
  console.log("producer started");
  await producer.connect();

  await producer.send({
    topic: topic,
    messages: [{ value: url }],
  });

  console.log("Message sent successfully");
  await producer.disconnect();
};
