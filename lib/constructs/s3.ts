import { RemovalPolicy } from 'aws-cdk-lib'
import { BlockPublicAccess, Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

export class FormsgS3Buckets extends Construct {
  readonly s3Attachment: Bucket
  readonly s3PaymentProof: Bucket
  readonly s3Image: Bucket
  readonly s3Logo: Bucket
  readonly s3StaticAssets: Bucket
  readonly s3VirusScannerQuarantine: Bucket
  readonly s3VirusScannerClean: Bucket
  constructor(scope: Construct, s3Suffix: string) {
    super(scope, `s3-${s3Suffix}`)

    this.s3Attachment = new Bucket(this, `attachment`, {
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    this.s3PaymentProof = new Bucket(this, `payment-proof`, {
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    this.s3Image = new Bucket(this, `image`, {
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
    })

    this.s3Logo = new Bucket(this, `logo`, {
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
    })

    this.s3StaticAssets = new Bucket(this, `static-assets`, {
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    this.s3VirusScannerQuarantine = new Bucket(this, `virus-scanner-quarantine`, {
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    this.s3VirusScannerClean = new Bucket(this, `virus-scanner-clean`, {
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

  }

}
