const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const optionator = require('optionator');

// Define the script's command-line options using optionator
const options = optionator({
  prepend: 'Usage: zip-build [options]',
  options: [
    {
      option: 'dir',
      alias: 'd',
      type: 'String',
      description: 'Path to the directory to include in the zip archive',
      required: true,
    },
    {
      option: 'output',
      alias: 'o',
      type: 'String',
      description: 'Name of the output zip file',
      required: true,
    },
  ],
});

// Parse the command-line arguments using optionator
const args = options.parse(process.argv);

// Get the directory path and output file name from the parsed arguments
const directoryPath = args.dir;
const outputZipFileName = args.output;

// Create a write stream for the output zip file
const outputZipFileStream = fs.createWriteStream(outputZipFileName);

// Create a new archiver instance
const archive = archiver('zip', { zlib: { level: 9 } });

// Listen for the 'warning' event
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});

// Listen for the 'error' event
archive.on('error', function(err) {
  throw err;
});

// Add the specified directory and its contents to the archive
archive.directory(directoryPath + '/', false);

// Finalize the archive and write it to the output stream
archive.finalize();
archive.pipe(outputZipFileStream);
