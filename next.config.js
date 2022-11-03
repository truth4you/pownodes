/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    domains: ['yiannimize.s3.eu-west-2.amazonaws.com','ipfs.infura.io','ipfs.moralis.io'],
  },
};
