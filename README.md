# Zama Swift Package

A Swift package providing seamless integration of TFHE-rs bindings into the Apple ecosystem, enabling developers to leverage fully homomorphic encryption (FHE) directly in Swift applications. This package simplifies cryptographic operations and provides a straightforward Swift-native API.

## Project Overview

Zama Swift aims to bridge Rust-based TFHE functionality with Swift, offering a secure and performant way to perform encrypted computations on Apple platforms. By encapsulating complex Rust code within a Swift Package Manager-compatible structure, developers can focus on building applications without handling low-level FFI intricacies.

## Goals

* Package TFHE-rs Rust bindings as a Swift Package
* Compile into an XCFramework for easy distribution
* Provide comprehensive documentation and integration guides
* Enable Swift developers to utilize FHE with minimal setup

## Features

### Core Features

* **Swift Package Manager Support**: Easily integrate the package into Xcode projects
* **XCFramework Compilation**: Cross-platform binary for macOS, iOS, and simulators
* **High Performance**: Rust backend ensures efficient encryption and computation
* **Type-safe Swift API**: Native Swift types and methods for easy adoption
* **Secure Computation**: Fully Homomorphic Encryption capabilities

### Encryption Capabilities

* **Binary Operations**: Perform encrypted addition, multiplication, and logical operations
* **Vectorized Computation**: Operate on encrypted arrays efficiently
* **Noise Management**: Automatic handling of noise growth during computations
* **Key Management**: Generate, store, and use FHE keys securely within Swift

### Documentation & Support

* Integration examples for iOS and macOS
* Step-by-step usage guide for encrypted computations
* API reference for all available Swift methods
* Best practices for performance and security

## Architecture

### Swift Package Structure

* `Sources/ZamaSwift/`: Swift wrapper for TFHE-rs bindings
* `Tests/`: Unit and integration tests
* `Package.swift`: Swift Package manifest
* `XCFrameworks/`: Precompiled binaries for Apple platforms

### Rust Backend

* `tfhe-rs`: Core Rust library providing FHE operations
* Safe Swift bindings generated via `cbindgen` and custom wrappers
* Efficient memory management for high-performance encryption

### Compilation & Integration

1. Clone the repository
2. Build XCFramework using Swift Package Manager
3. Add `ZamaSwift` as a dependency in Xcode projects
4. Import `ZamaSwift` in Swift files and call API methods

## Technology Stack

### Languages

* Swift 5+ for wrapper and API
* Rust 1.70+ for cryptography backend

### Tools

* Swift Package Manager for distribution
* Xcode for macOS and iOS development
* cbindgen for Rust-Swift interoperability
* XCFramework for cross-platform binaries

## Installation

### Requirements

* macOS 12+ or iOS 14+
* Xcode 14+
* Swift Package Manager

### Steps

1. Add the package dependency in Xcode:

```swift
// In Package.swift
.package(path: "./ZamaSwift")
```

2. Build the project to generate XCFrameworks automatically
3. Import `ZamaSwift` in your Swift code:

```swift
import ZamaSwift
```

## Usage

### Example: Encrypting and Decrypting a Value

```swift
let fhe = ZamaSwiftFHE()
let secretKey = fhe.generateSecretKey()
let plaintext = 42

let ciphertext = try fhe.encrypt(plaintext, with: secretKey)
let decrypted = try fhe.decrypt(ciphertext, with: secretKey)

print("Decrypted value: \(decrypted)")
```

### Example: Performing Encrypted Addition

```swift
let a = try fhe.encrypt(10, with: secretKey)
let b = try fhe.encrypt(20, with: secretKey)
let sum = try fhe.add(a, b)
let result = try fhe.decrypt(sum, with: secretKey)

print("Encrypted sum result: \(result)")
```

## Testing

* Unit tests for all Swift API functions
* Integration tests covering full encryption/decryption cycle
* Automated XCFramework build verification

## Security Features

* Fully Homomorphic Encryption ensures data remains encrypted during computation
* Rust backend prevents accidental exposure of plaintext
* Swift wrapper enforces type safety and memory safety
* Secret keys never leave the secure context in Swift runtime

## Contribution Guidelines

* Fork the repository and create feature branches
* Write tests for new features
* Submit pull requests with clear descriptions
* Follow Swift API design guidelines

## Roadmap

* Expand vectorized encrypted operations
* Add support for more advanced FHE schemes
* Provide sample applications demonstrating real-world usage
* Continuous improvement of performance and memory usage
* Integration with SwiftUI for live encrypted data visualization

## License

MIT License

## Contact

For questions or support, open issues in the repository or reach out to maintainers through official channels.

---

Zama Swift Package is designed to make homomorphic encryption accessible to Apple developers, providing a secure, performant, and easy-to-use Swift-native interface for advanced cryptographic operations.
