async function main() {
	const timestamp = parseInt(new Date("2022-06-20")/1000)
	await network.provider.send("evm_setNextBlockTimestamp", [timestamp] )
  	await network.provider.send("evm_mine") 
  	console.log(timestamp)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })